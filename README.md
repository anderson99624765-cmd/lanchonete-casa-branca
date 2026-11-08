# 🏡 Lanchonete Casa Branca - Guia de Configuração e Uso

Sistema completo de Delivery & Retirada online para a **Lanchonete Casa Branca** (*"O sabor que faz você se sentir em casa."*).

---

## 📁 Estrutura de Arquivos Entregue

```
lanchonete-casa-branca/
│
├── index.html                   # Página principal do cliente (Cardápio, sacola, checkout)
├── admin.html                   # Painel administrativo protegido por autenticação
├── database.rules.json          # Regras de segurança do Firebase Realtime Database
├── README.md                    # Manual completo de configuração, segurança e uso
│
├── css/
│   ├── style.css                # Estilos globais, tema acolhedor, layout mobile-first
│   └── admin.css                # Estilos dedicados ao painel administrativo e login
│
└── js/
    ├── app.js                   # Controlador da área do cliente
    ├── admin.js                 # Controlador do painel administrativo
    ├── auth.js                  # Módulo de autenticação, inatividade, redefinição e validação de senha
    └── modules/
        ├── firebase-config.js   # Credenciais do Firebase e configurações padrão
        ├── firebase-service.js  # Conexão RTDB, Auth e script de Seed inicial
        ├── carrinho.js          # Lógica do carrinho, cálculos, WhatsApp e checkout
        ├── cardapio.js          # Renderização de produtos, categorias e busca
        └── utils.js             # Formatação BRL, máscaras, áudio de alerta, toasts
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
   - Alteração do e-mail de acesso com reautenticação imediata.

---

## 🛡️ 2. Regras de Segurança do Firebase Realtime Database

Cole o conteúdo completo do arquivo [database.rules.json](database.rules.json) na aba **Regras** do Realtime Database. As regras deixam a listagem de `/pedidos` e a leitura de `/pedidosPrivados` restritas ao admin. O cliente pode ler somente `/pedidos/{id}` quando possui o ID aleatório; esse nó contém apenas dados de acompanhamento, sem telefone ou endereço. A gravação pública só cria registros novos; status, histórico, previsão e motivo de cancelamento exigem admin.

As regras identificam o administrador pelo e-mail `casabranca@gmail.com`. Se a conta do Firebase Auth do proprietário usa outro e-mail, substitua esse e-mail nas condições de administrador do arquivo de regras antes de publicar.

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
6. Crie o usuário com o e-mail permitido nas regras (`casabranca@gmail.com`, ou o e-mail que você configurou nelas) e uma senha inicial forte.
7. O Firebase criará a conta e exibirá na tabela o e-mail, a data de criação e a coluna **UID do usuário** (um código como `f482A9x...`).
8. Pronto! Agora acesse `admin.html` no navegador e faça login com esses dados.

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

### Para Encerrar a Sessão:
- Clique no botão vermelho **Sair 🚪** no canto superior direito do topo do painel. A sessão será desfeita imediatamente e a tela de login será exibida.
