# 🏡 Lanchonete Casa Branca - Guia de Configuração e Uso

Sistema completo de Delivery & Retirada online para a **Lanchonete Casa Branca** (*"O sabor que faz você se sentir em casa."*).

---

## 📁 Estrutura de Arquivos Entregue

```
lanchonete-casa-branca/
├── index.html                   # Página do cliente (cardápio, sacola, checkout)
├── admin.html                   # Painel administrativo (exige login Firebase)
├── acompanhar.html              # Acompanhamento público do pedido por ID
├── diagnostico.html             # Diagnóstico da conexão Firebase (somente admin)
├── database.rules.json          # Regras do Realtime Database
├── README.md
├── css/
│   ├── style.css                # Estilos globais (mobile-first)
│   ├── admin.css                # Painel administrativo e login
│   ├── acompanhamento.css       # Tela de acompanhamento
│   └── diagnostico.css          # Tela de diagnóstico
└── js/
    ├── firebase.js              # Configuração do Firebase, ADMIN_UID e dados do seed
    ├── app.js                   # Controlador da área do cliente
    ├── admin.js                 # Controlador do painel administrativo
    ├── auth.js                  # Login, inatividade, senha e e-mail
    ├── acompanhamento.js        # Tela pública do status do pedido
    ├── diagnostico.js           # Testes de conexão/permissão
    ├── notificacoes.js          # Modelos e links do WhatsApp
    └── modules/
        ├── firebase-service.js  # RTDB, Auth, seed e migração
        ├── carrinho.js          # Carrinho, cálculos, checkout e WhatsApp
        ├── cardapio.js          # Renderização de produtos, categorias e busca
        └── utils.js             # Formatação, máscaras, toasts e sanitização
```

---

## 🔒 1. Segurança e Sistema de Login do Painel

O acesso ao painel administrativo (`admin.html`) foi construído com as seguintes camadas de proteção:
1. **Bloqueio de Carregamento Prévio**: O painel inicia com `display: none` direto no HTML. Nenhum dado do banco (pedidos, clientes, produtos) é assinado ou renderizado antes do Firebase confirmar que há um usuário autenticado.
2. **Mensagens Amigáveis e Seguras**: Erros de login não revelam se foi o e-mail ou a senha que falhou (*"E-mail ou senha incorretos"*).
3. **Persistência de Sessão**: Caixa de seleção *"Manter conectado"* marcada por padrão (`browserLocalPersistence`).
4. **Auto-Logout por Inatividade**: O sistema monitora cliques, rolagem e digitação. Se o proprietário ficar 2 horas sem interagir na página, a sessão é encerrada automaticamente com aviso na tela.
5. **Recuperação de Senha**: Link *"Esqueci minha senha"* com envio de link de redefinição oficial do Firebase.
6. **Área de Segurança no Painel (Minha Conta)**:
   - Alteração de senha exigindo confirmação da senha atual (reautenticação).
   - Validador e medidor de força de senha ao vivo (mínimo de 8 caracteres com letras e números).
   - Alteração do e-mail de acesso com reautenticação e confirmação por link enviado ao novo e-mail.

O painel aceita exclusivamente sessão Firebase Auth; não existem credenciais de administrador hardcoded nem fallback de sessão local.

## 🔌 Configurar a Conexão Firebase

O `js/firebase.js` guarda a configuração pública do app Web (apiKey e IDs). Ela não é secreta; quem protege os dados são as regras do banco. Restrinja a apiKey ao seu domínio no Google Cloud Console. Enquanto houver marcadores `COLE_...` sem substituir, o app mostra o estado vermelho, não carrega dados locais como catálogo e bloqueia gravações. Essa configuração é necessária antes de testar sincronização entre aparelhos.

1. No [Firebase Console](https://console.firebase.google.com/), crie um projeto ou abra o projeto correto da lanchonete.
2. Em **Build > Realtime Database**, crie o banco e escolha a região. Copie a URL exata mostrada nessa tela; ela pode terminar em `firebasedatabase.app` ou `firebaseio.com`.
3. Em **Project settings > General > Your apps**, registre um app Web ou selecione o existente e copie `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId` para o único arquivo [js/firebase.js](js/firebase.js). Use também a URL RTDB do mesmo projeto em `databaseURL`.
4. Em **Build > Authentication > Sign-in method**, habilite **Email/Password**. Em **Users**, crie a conta do proprietário, copie o UID dessa conta e coloque-o em `ADMIN_UID` no arquivo `js/firebase.js`.
5. Cole o arquivo completo [database.rules.json](database.rules.json) em **Realtime Database > Rules**, substitua `COLE_UID_DO_ADMIN` pelo mesmo UID e publique.
6. Sirva o site por HTTPS ou localhost, entre no `admin.html` com a conta Firebase e confirme o estado verde **Conectado ao banco de dados**. O primeiro login autenticado cria config, categorias e produtos no RTDB se os nós estiverem vazios.
7. Em outra aba/aparelho com a mesma publicação, abra o cardápio. Verifique no console do Realtime Database `/config`, `/categorias`, `/produtos`, `/clientes` e `/pedidos` após cada operação.

O SDK usado é Firebase modular v13.2.0 para App, Realtime Database e Auth. Não há imports compat ou Firestore neste fluxo. `databaseURL` deve vir da tela de Realtime Database, não de uma URL Firestore.

No admin, verde significa que `.info/connected` reportou conexão. Vermelho indica configuração ausente ou conexão perdida. Os toasts **Salvo no banco ✅** aparecem somente depois que a promessa do Firebase resolve; erros de rede/permissão são exibidos e não são tratados como sucesso.

Dados antigos podem continuar no armazenamento local de um aparelho. Depois de conectar e autenticar, use **Configurações > Migração de dados deste aparelho**. A ação pede confirmação, aplica configurações locais apenas quando o remoto ainda é o seed padrão, atualiza categorias/produtos equivalentes sem duplicar, preserva clientes/pedidos já existentes e marca a migração como concluída naquele aparelho. Se ocorrer falha parcial, o marcador não é gravado e a migração pode ser tentada novamente. Carrinho, dados pré-preenchidos, IDs de pedidos recentes e o marcador continuam locais por conveniência; config, catálogo, clientes e pedidos não são lidos nem gravados por fallback local.

---

## 🛡️ 2. Regras de Segurança do Firebase Realtime Database

Cole o conteúdo completo do arquivo [database.rules.json](database.rules.json) na aba **Regras** do Realtime Database. As regras deixam a listagem de `/pedidos` e a leitura de `/pedidosPrivados` restritas ao admin. O cliente pode ler somente `/pedidos/{id}` quando possui o ID aleatório; esse nó contém apenas dados de acompanhamento, sem telefone ou endereço. A gravação pública só cria registros novos; status, histórico, previsão e motivo de cancelamento exigem admin.

As regras e o painel autorizam o administrador pelo UID do Firebase Auth. O placeholder `COLE_UID_DO_ADMIN` precisa ser substituído pelo mesmo UID em `js/firebase.js` e [database.rules.json](database.rules.json); enquanto estiver sem substituição, gravações admin permanecem bloqueadas.

## 🧪 Rodar localmente

Os módulos ES não funcionam abrindo o arquivo direto (`file://`). Na pasta do projeto, rode `python3 -m http.server 8000` e acesse `http://localhost:8000`. Para validar a conexão e as regras, abra `diagnostico.html` logado como admin.

---

## 📦 3. Acompanhamento de Pedidos

Após finalizar, o cliente vai para `acompanhar.html` e recebe no WhatsApp um link privado baseado no ID do pedido. A tela acompanha as etapas em tempo real, mostra os horários do histórico, previsão e motivo de cancelamento. O painel oferece a próxima etapa correta para entrega ou retirada, campo de previsão, cancelamento e aviso pelo WhatsApp.

O cabeçalho do cardápio abre **Meus pedidos** e mostra pedidos recentes salvos no aparelho. A busca por número e telefone verifica somente essa lista local; uma busca remota segura entre aparelhos requer um endpoint de servidor/Cloud Function. O link direto funciona em outro aparelho porque o ID aleatório do pedido é a credencial de acesso ao resumo público. Não compartilhe esse link com terceiros.

Este projeto não tem backend/Cloud Functions. Por isso, o número curto atual continua sendo apenas um identificador de exibição aleatório, não uma sequência global garantida; números sequenciais sem colisões exigem alocação transacional no servidor. O ID do banco continua sendo o `push()` aleatório e nunca depende desse número curto.

## 🟢 Avisos de Status pelo WhatsApp

No painel, o proprietário pode escolher os status que abrem o aviso automaticamente e editar os modelos em **Configurações > Mensagens do WhatsApp**. O botão do cartão sempre permite abrir o mesmo editor manualmente. O site usa links `wa.me`, sem API paga; o proprietário revisa e envia a mensagem no próprio WhatsApp. Depois, deve confirmar no painel para registrar `enviado: true`; abrir o WhatsApp sozinho não comprova o envio. Os avisos ficam em `/pedidos/{id}/notificacoes`, e somente o admin autorizado pode gravá-los conforme as regras.

---

## 👤 4. Passo a Passo do Primeiro Acesso (Criando o Dono)

1. Acesse o [Console do Firebase](https://console.firebase.google.com/).
2. Abra o projeto da **Lanchonete Casa Branca**.
3. No menu lateral, clique em **Criação > Authentication**.
4. Certifique-se de que o método **E-mail/senha** está ativado na aba *Sign-in method*.
5. Na aba **Users (Usuários)**, clique no botão azul **"Adicionar usuário"**.
6. Crie o usuário do proprietário com o e-mail desejado e uma senha forte.
7. Copie o **UID do usuário** criado (um código como `f482A9x...`) para `ADMIN_UID` em `js/firebase.js` e substitua `COLE_UID_DO_ADMIN` nas regras antes de publicar.
8. Acesse `admin.html` e entre com essa conta Firebase; o painel só aceita o UID configurado.

---

## 🔑 5. Como o Proprietário Utiliza o Sistema

### Para Fazer Login:
1. Acesse `seusite.com/admin.html` (ou clique em *"Área do Dono"* no topo do cardápio).
2. Digite o e-mail e a senha cadastrados.
3. Se quiser manter a sessão ativa neste dispositivo, deixe *"Manter conectado"* marcado.
4. Clique em **Entrar no Painel**.

### Se Esquecer a Senha:
1. Na tela de login, clique no link **"Esqueci minha senha"**.
2. Confirme seu e-mail cadastrado e clique em **Enviar Link de Redefinição**.
3. Abra sua caixa de entrada (ou lixeira/spam), clique no link oficial do Firebase e digite sua nova senha.
4. Volte à tela de login e entre com a nova senha.

### Para Alterar a Senha ou o E-mail de Acesso:
1. No painel admin, clique na aba **🛡️ Minha Conta & Segurança**.
2. Para trocar a senha:
   - Digite sua senha atual.
   - Digite a nova senha (observe o medidor de força ficando verde: mínimo 8 caracteres com letras e números).
   - Repita a nova senha e clique em **Atualizar Senha**.
3. Para trocar o e-mail:
   - Digite o novo e-mail.
   - Digite sua senha atual para autorizar e clique em **Atualizar E-mail**.
   - Abra o link de confirmação enviado ao novo e-mail; o e-mail de acesso só muda depois disso.

### Para Encerrar a Sessão:
- Clique no botão vermelho **Sair 🚪** no canto superior direito do topo do painel. A sessão será desfeita imediatamente e a tela de login será exibida.
