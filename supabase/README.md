# Supabase Edge Functions for RecifeMais AI Assistant

This directory contains Edge Functions required for the application to work correctly.

## `sympla-proxy`

### Purpose

The `sympla-proxy` function acts as a secure backend proxy for making API calls to the Sympla API. This is necessary because the Sympla API does not support Cross-Origin Resource Sharing (CORS) requests directly from a web browser. Calling it from the frontend would result in a `Failed to fetch` error.

This function solves the problem by:
1.  Receiving a request from the frontend app.
2.  Securely fetching the user's Sympla API token from the `profiles` table in the database.
3.  Making the API call to Sympla from the server-side, where there are no CORS restrictions.
4.  Returning the data back to the frontend.

## `url-scraper`

### Purpose
The `url-scraper` function is a crucial utility to fetch the HTML content of any given URL, bypassing browser CORS policies and common anti-scraping measures. Instead of a simple fetch, it now uses a headless browser service (**Browserless.io**) to render the page, including JavaScript, making it appear like a real user. This drastically improves the reliability of the "Importar Evento" feature.

---

## Deployment and Configuration

Para usar as integrações, você precisa implantar e configurar as funções no seu projeto Supabase. **Siga estes passos na ordem correta.**

### **Pré-requisitos: Preparando Seu Computador**

Antes de tudo, você precisa de uma ferramenta em seu computador para se comunicar com seu projeto Supabase. Esta ferramenta é o **Supabase CLI**.

1.  **Instale a CLI:** Siga as instruções de instalação para o seu sistema operacional no [Guia Oficial do Supabase CLI](https://supabase.com/docs/guides/cli).

2.  **Faça Login na sua Conta:** Abra seu terminal (ou prompt de comando) e rode o comando:
    ```bash
    supabase login
    ```
    Isso abrirá uma página no seu navegador para você autorizar a CLI a acessar sua conta Supabase.

3.  **Conecte a Pasta do Projeto:** Navegue no seu terminal até a pasta onde este projeto está salvo. Em seguida, conecte-a ao seu projeto Supabase específico com o comando abaixo.
    ```bash
    supabase link --project-ref <your-project-ref>
    ```
    Você encontra o `<your-project-ref>` na URL do seu painel Supabase (`https://supabase.com/dashboard/project/<your-project-ref>`) ou em **Project Settings > General**.

Com seu computador preparado, você está pronto para implantar as funções.

---

### **Passo 1: Implante as Funções a Partir do Seu Computador**

Agora que sua máquina está conectada ao seu projeto, você pode "enviar" o código das funções para a nuvem do Supabase.

No seu terminal, na pasta raiz do projeto, rode os seguintes comandos, um de cada vez:

```bash
# Deploy the Sympla proxy function
supabase functions deploy sympla-proxy --no-verify-jwt

# Deploy the URL scraper function
supabase functions deploy url-scraper --no-verify-jwt
```
Após os comandos serem executados com sucesso, verifique o painel do seu projeto Supabase na seção **Edge Functions**. As funções `sympla-proxy` e `url-scraper` deverão estar listadas lá.

---

### **Passo 2: Configure os Segredos (Secrets)**

As funções precisam de chaves de API para funcionar. Nós as armazenamos como "Secrets" para mantê-las seguras.

#### **A. Segredo para `sympla-proxy`**

1.  Vá para o painel do seu projeto Supabase.
2.  Navegue até **Project Settings** (o ícone de engrenagem) > **API**.
3.  Encontre a seção `Project API keys`.
4.  Copie a chave do campo `service_role`. Ela começa com `eyJ...`.
5.  No menu à esquerda, navegue até **Edge Functions**, clique na função `sympla-proxy`.
6.  Vá para a aba **Secrets**, clique em **Add new secret**.
7.  **Name**: `SUPABASE_SERVICE_ROLE_KEY`
8.  **Value**: Cole a chave `service_role`.
9.  Clique em **Save**.

#### **B. Segredo para `url-scraper`**

Esta função usa o serviço **Browserless.io** para evitar bloqueios de scraping.

1.  **Crie uma conta gratuita** em [Browserless.io](https://www.browserless.io/). O plano "Free" é suficiente.
2.  No seu dashboard do Browserless, copie sua **API key**.
3.  Volte para o painel do Supabase, em **Edge Functions**, e clique na função `url-scraper`.
4.  Vá para a aba **Secrets**, clique em **Add new secret**.
5.  **Name**: `BROWSERLESS_API_KEY`
6.  **Value**: Cole a sua chave da API do Browserless.
7.  Clique em **Save**.


Após esses passos, todas as funcionalidades de integração estarão 100% operacionais.
