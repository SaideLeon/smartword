# PaySuite API Documentation

> Documentação extraída de: https://paysuite.tech/docs/  
> Última actualização oficial: **29 de Março de 2026**  
> Gerado em: Abril 2026

---

## Índice (Table of Contents)

1. [Introdução](#1-introdução)
2. [Métodos de Pagamento](#2-métodos-de-pagamento)
3. [Autenticação](#3-autenticação)
4. [Tratamento de Erros](#4-tratamento-de-erros)
5. [Webhooks](#5-webhooks)
   - [5.1 Configuração](#51-configuração)
   - [5.2 Eventos](#52-eventos)
     - [payment.success](#payloadsuccess)
     - [payment.failed](#payloadfailed)
   - [5.3 Segurança](#53-segurança)
   - [5.4 Headers](#54-headers)
   - [5.5 Boas Práticas](#55-boas-práticas)
6. [Payment Requests](#6-payment-requests)
   - [6.1 Create Payment Request — POST /api/v1/payments](#61-create-payment-request)
   - [6.2 Get Payment Request — GET /api/v1/payments/{id}](#62-get-payment-request)
7. [Payout Requests](#7-payout-requests)
   - [7.1 List Payouts — GET /api/v1/payouts](#71-list-payouts)
   - [7.2 Get Payout — GET /api/v1/payouts/{id}](#72-get-payout)
8. [Refunds](#8-refunds)
   - [8.1 List Refunds — GET /api/v1/refunds](#81-list-refunds)
   - [8.2 Create Refund — POST /api/v1/refunds](#82-create-refund)
   - [8.3 Get Refund — GET /api/v1/refunds/{id}](#83-get-refund)
9. [Recursos Adicionais](#9-recursos-adicionais)

---

## 1. Introdução

**PaySuite** permite processamento seguro de pagamentos através de MPesa, Emola e Cartões de Crédito/Débito, com actualizações de transacções em tempo real e relatórios detalhados.

**Base URL da API:**
```
https://paysuite.tech/api/v1
```

---

## 2. Métodos de Pagamento

Métodos de pagamento disponíveis para os seus clientes:

### 1. MPesa
- Pagamentos por dinheiro móvel
- Processamento instantâneo
- Requer número MPesa válido

### 2. Emola
- Pagamentos por carteira digital
- Processamento instantâneo
- Requer conta Emola válida

### 3. Cartão de Crédito/Débito
- Tempo de processamento: 1–2 dias úteis
- Requer detalhes de cartão válidos

---

## 3. Autenticação

Todas as requisições à API requerem um token de autenticação Bearer.

**Inclua o token em todas as requisições:**

```bash
curl -X POST "https://paysuite.tech/api/v1/payments" \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json"
```

> Obtenha o seu token de API no painel do merchant em **Settings > API Access**.

---

## 4. Tratamento de Erros

Todas as respostas da API utilizam o seguinte formato:

```json
{
  "status": "error",
  "message": "Invalid input"
}
```

### Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| `400`  | Dados de requisição inválidos |
| `401`  | Token de API inválido |
| `402`  | Pagamento falhou |
| `404`  | Recurso não encontrado |
| `422`  | Erro de validação |
| `429`  | Demasiadas requisições (rate limit excedido) |

### Rate Limits

- **100 requisições por minuto** por merchant
- **Retries de Webhook:** 5 tentativas com backoff exponencial

---

## 5. Webhooks

Receba notificações instantâneas para eventos de pagamento.

### 5.1 Configuração

1. Adicione o URL do seu webhook nas definições do merchant
2. Guarde o seu webhook secret em segurança
3. Use o secret para validar os webhooks recebidos

### 5.2 Eventos

#### payment.success

Enviado quando o pagamento é bem-sucedido.

```json
{
  "event": "payment.success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100.50,
    "reference": "INV2024001",
    "transaction": {
      "id": "tr_123456",
      "method": "mpesa",
      "paid_at": "2024-02-10T10:15:00.000000Z"
    }
  },
  "created_at": 1708235285,
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### payment.failed

Enviado quando o pagamento falha.

```json
{
  "event": "payment.failed",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100.50,
    "reference": "INV2024001",
    "error": "Insufficient funds"
  },
  "created_at": 1708235285,
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 5.3 Segurança

Verifique a autenticidade do webhook comparando a assinatura HMAC-SHA256:

```php
<?php
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$secret = 'your_webhook_secret';

$calculatedSignature = hash_hmac('sha256', $payload, $secret);

if (hash_equals($signature, $calculatedSignature)) {
    $data = json_decode($payload, true);
    // Process the event
}
```

### 5.4 Headers

| Header | Descrição |
|--------|-----------|
| `X-Webhook-Signature` | Assinatura da requisição |
| `X-Account-Id` | ID da sua conta merchant |
| `Content-Type` | `application/json` |
| `User-Agent` | `PaySuite-Webhook/1.0` |

### 5.5 Boas Práticas

1. Verifique sempre as assinaturas
2. Processe eventos apenas uma vez (verifique `request_id`)
3. Responda dentro de **5 segundos**
4. Implemente tratamento de retries
5. Registe os eventos para debugging
6. Teste no sandbox antes de ir para produção

---

## 6. Payment Requests

APIs para gestão de pedidos de pagamento.

### 6.1 Create Payment Request

> **Requer autenticação** · Cria um novo pedido de pagamento no sistema.

```
POST /api/v1/payments
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### Body Parameters

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `amount` | numeric | ✅ | Valor do pagamento em MZN. Ex: `100.50` |
| `reference` | string | ✅ | Referência única do pagamento (máx: 50 caracteres). Ex: `INV2024001` |
| `description` | string | ❌ | Descrição do pagamento (máx: 125 caracteres). Ex: `Payment for invoice INV2024001` |
| `method` | string | ❌ | Método de pagamento. Valores: `credit_card`, `mpesa`, `emola` |
| `return_url` | string | ❌ | URL para redirecionar após o pagamento. Ex: `https://example.com/success` |
| `callback_url` | string | ❌ | URL para notificação de callback |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request POST \
    "https://paysuite.tech/api/v1/payments" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json" \
    --data "{
    \"amount\": \"100.50\",
    \"reference\": \"INV2024001\",
    \"description\": \"Payment for invoice INV2024001\",
    \"return_url\": \"https://example.com/success\"
}"
```

**JavaScript (fetch):**
```javascript
const url = new URL("https://paysuite.tech/api/v1/payments");

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

let body = {
    "amount": "100.50",
    "reference": "INV2024001",
    "description": "Payment for invoice INV2024001",
    "return_url": "https://example.com/success"
};

fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/payments';
$response = $client->post(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'amount' => '100.50',
            'reference' => 'INV2024001',
            'description' => 'Payment for invoice INV2024001',
            'return_url' => 'https://example.com/success',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests
import json

url = 'https://paysuite.tech/api/v1/payments'
payload = {
    "amount": "100.50",
    "reference": "INV2024001",
    "description": "Payment for invoice INV2024001",
    "return_url": "https://example.com/success"
}
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('POST', url, headers=headers, json=payload)
response.json()
```

#### Respostas

**201 — Criado com sucesso:**
```json
{
    "status": "success",
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "amount": 100.5,
        "reference": "INV2024001",
        "status": "pending",
        "checkout_url": "https://paysuite.test/checkout/550e8400-e29b-41d4-a716-446655440000"
    }
}
```

**422 — Erro de validação:**
```json
{
    "status": "error",
    "message": "Invalid input"
}
```

---

### 6.2 Get Payment Request

> **Requer autenticação** · Retorna os detalhes de um pedido de pagamento específico.

```
GET /api/v1/payments/{id}
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### URL Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string (ULID) | ULID do pedido de pagamento. Ex: `01H8X9V8X9Y8Z9A8B8C8D8E8F8` |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request GET \
    --get "https://paysuite.tech/api/v1/payments/01H8X9V8X9Y8Z9A8B8C8D8E8F8" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json"
```

**JavaScript (fetch):**
```javascript
const url = new URL(
    "https://paysuite.tech/api/v1/payments/01H8X9V8X9Y8Z9A8B8C8D8E8F8"
);

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

fetch(url, {
    method: "GET",
    headers,
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/payments/01H8X9V8X9Y8Z9A8B8C8D8E8F8';
$response = $client->get(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests
import json

url = 'https://paysuite.tech/api/v1/payments/01H8X9V8X9Y8Z9A8B8C8D8E8F8'
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('GET', url, headers=headers)
response.json()
```

#### Respostas

**200 — Sucesso:**
```json
{
    "status": "success",
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "amount": 100.5,
        "reference": "INV2024001",
        "status": "paid",
        "transaction": {
            "id": 1,
            "status": "completed",
            "transaction_id": "MPESA123456",
            "paid_at": "2024-02-10T10:15:00.000000Z"
        }
    }
}
```

**404 — Não encontrado:**
```json
{
    "status": "error",
    "message": "Payment request not found."
}
```

---

## 7. Payout Requests

APIs para gestão de pedidos de payout.

> **Statuses possíveis:** `pending`, `completed`, `failed`, `cancelled`

### 7.1 List Payouts

> **Requer autenticação** · Retorna uma lista paginada de payouts para a conta autenticada.

```
GET /api/v1/payouts
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | integer | ❌ | Número da página. Ex: `1` |
| `limit` | integer | ❌ | Número de itens por página. Ex: `15` |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request GET \
    --get "https://paysuite.tech/api/v1/payouts?page=1&limit=15" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json"
```

**JavaScript (fetch):**
```javascript
const url = new URL("https://paysuite.tech/api/v1/payouts");

const params = {
    "page": "1",
    "limit": "15",
};
Object.keys(params)
    .forEach(key => url.searchParams.append(key, params[key]));

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

fetch(url, {
    method: "GET",
    headers,
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/payouts';
$response = $client->get(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'query' => [
            'page' => '1',
            'limit' => '15',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests

url = 'https://paysuite.tech/api/v1/payouts'
params = {
  'page': '1',
  'limit': '15',
}
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('GET', url, headers=headers, params=params)
response.json()
```

#### Respostas

**200 — Sucesso:**
```json
{
    "data": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "amount": 100.00,
            "reference": "PO123ABC456",
            "status": "pending",
            "description": "Payout request",
            "method": "mpesa",
            "beneficiary": {
                "phone": "841234567",
                "holder": "John Doe"
            },
            "created_at": "2024-02-28T10:00:00.000000Z"
        }
    ],
    "links": {...},
    "meta": {...}
}
```

---

### 7.2 Get Payout

> **Requer autenticação** · Retorna os detalhes de um payout específico.

```
GET /api/v1/payouts/{id}
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### URL Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string (ULID) | ULID do payout. Ex: `01H8X9V8X9Y8Z9A8B8C8D8E8F8` |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request GET \
    --get "https://paysuite.tech/api/v1/payouts/01H8X9V8X9Y8Z9A8B8C8D8E8F8" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json"
```

**JavaScript (fetch):**
```javascript
const url = new URL(
    "https://paysuite.tech/api/v1/payouts/01H8X9V8X9Y8Z9A8B8C8D8E8F8"
);

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

fetch(url, {
    method: "GET",
    headers,
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/payouts/01H8X9V8X9Y8Z9A8B8C8D8E8F8';
$response = $client->get(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests

url = 'https://paysuite.tech/api/v1/payouts/01H8X9V8X9Y8Z9A8B8C8D8E8F8'
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('GET', url, headers=headers)
response.json()
```

#### Respostas

**200 — Sucesso:**
```json
{
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "amount": 100,
        "reference": "PO123ABC456",
        "status": "pending",
        "description": "Payout request",
        "method": "mpesa",
        "beneficiary": {
            "phone": "841234567",
            "holder": "John Doe"
        },
        "created_at": "2024-02-28T10:00:00.000000Z"
    }
}
```

**404 — Não encontrado:**
```json
{
    "message": "Payout not found."
}
```

---

## 8. Refunds

APIs para gestão de reembolsos.

> **Statuses possíveis:** `pending`, `processing`, `completed`, `failed`, `cancelled`

### 8.1 List Refunds

> **Requer autenticação** · Retorna uma lista paginada de reembolsos para a conta autenticada.

```
GET /api/v1/refunds
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | integer | ❌ | Número da página. Ex: `1` |
| `limit` | integer | ❌ | Número de itens por página (máx: 100). Ex: `20` |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request GET \
    --get "https://paysuite.tech/api/v1/refunds?page=1&limit=20" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json"
```

**JavaScript (fetch):**
```javascript
const url = new URL("https://paysuite.tech/api/v1/refunds");

const params = {
    "page": "1",
    "limit": "20",
};
Object.keys(params)
    .forEach(key => url.searchParams.append(key, params[key]));

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

fetch(url, {
    method: "GET",
    headers,
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/refunds';
$response = $client->get(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'query' => [
            'page' => '1',
            'limit' => '20',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests

url = 'https://paysuite.tech/api/v1/refunds'
params = {
  'page': '1',
  'limit': '20',
}
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('GET', url, headers=headers, params=params)
response.json()
```

#### Respostas

**200 — Sucesso:**
```json
{
    "data": [
        {
            "id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
            "payment_id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
            "amount": 50.00,
            "status": "completed",
            "reason": "Customer requested refund"
        }
    ],
    "links": {...},
    "meta": {...}
}
```

**422 — Validação:**
```json
{
    "message": "The limit field must not be greater than 100."
}
```

---

### 8.2 Create Refund

> **Requer autenticação** · Cria um novo pedido de reembolso para um pagamento concluído.

```
POST /api/v1/refunds
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### Body Parameters

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `payment_id` | ULID | ✅ | ID do pagamento a reembolsar. Ex: `01H8X9V8X9Y8Z9A8B8C8D8E8F8` |
| `amount` | numeric | ✅ | Valor do reembolso (mín: 0.01, máx: 10.000.000). Ex: `50.00` |
| `reason` | string | ✅ | Motivo do reembolso (máx: 500 caracteres). Ex: `Customer requested refund` |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request POST \
    "https://paysuite.tech/api/v1/refunds" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json" \
    --data "{
    \"payment_id\": \"01H8X9V8X9Y8Z9A8B8C8D8E8F8\",
    \"amount\": \"50.00\",
    \"reason\": \"Customer requested refund\"
}"
```

**JavaScript (fetch):**
```javascript
const url = new URL("https://paysuite.tech/api/v1/refunds");

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

let body = {
    "payment_id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
    "amount": "50.00",
    "reason": "Customer requested refund"
};

fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/refunds';
$response = $client->post(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'payment_id' => '01H8X9V8X9Y8Z9A8B8C8D8E8F8',
            'amount' => '50.00',
            'reason' => 'Customer requested refund',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests
import json

url = 'https://paysuite.tech/api/v1/refunds'
payload = {
    "payment_id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
    "amount": "50.00",
    "reason": "Customer requested refund"
}
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('POST', url, headers=headers, json=payload)
response.json()
```

#### Respostas

**201 — Criado com sucesso:**
```json
{
    "status": "success",
    "data": {
        "id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
        "payment_id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
        "amount": 50,
        "status": "pending",
        "reason": "Customer requested refund"
    }
}
```

**404 — Pagamento não encontrado:**
```json
{
    "status": "error",
    "message": "Payment not found."
}
```

**422 — Pagamento não pode ser reembolsado:**
```json
{
    "status": "error",
    "message": "Payment cannot be refunded. It must be completed and have available refund amount."
}
```

**422 — Valor excede o disponível:**
```json
{
    "status": "error",
    "message": "Refund amount cannot exceed available refund amount of {amount}."
}
```

---

### 8.3 Get Refund

> **Requer autenticação** · Retorna os detalhes de um reembolso específico, incluindo registos do gateway.

```
GET /api/v1/refunds/{id}
```

#### Headers

| Header | Exemplo |
|--------|---------|
| `Authorization` | `Bearer {YOUR_AUTH_KEY}` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

#### URL Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do reembolso |
| `ulid` | string (ULID) | ULID do reembolso. Ex: `01H8X9V8X9Y8Z9A8B8C8D8E8F8` |

#### Exemplos de Requisição

**cURL:**
```bash
curl --request GET \
    --get "https://paysuite.tech/api/v1/refunds/01H8X9V8X9Y8Z9A8B8C8D8E8F8" \
    --header "Authorization: Bearer {YOUR_AUTH_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json"
```

**JavaScript (fetch):**
```javascript
const url = new URL(
    "https://paysuite.tech/api/v1/refunds/01H8X9V8X9Y8Z9A8B8C8D8E8F8"
);

const headers = {
    "Authorization": "Bearer {YOUR_AUTH_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
};

fetch(url, {
    method: "GET",
    headers,
}).then(response => response.json());
```

**PHP (Guzzle):**
```php
$client = new \GuzzleHttp\Client();
$url = 'https://paysuite.tech/api/v1/refunds/01H8X9V8X9Y8Z9A8B8C8D8E8F8';
$response = $client->get(
    $url,
    [
        'headers' => [
            'Authorization' => 'Bearer {YOUR_AUTH_KEY}',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
    ]
);
$body = $response->getBody();
print_r(json_decode((string) $body));
```

**Python (requests):**
```python
import requests

url = 'https://paysuite.tech/api/v1/refunds/01H8X9V8X9Y8Z9A8B8C8D8E8F8'
headers = {
  'Authorization': 'Bearer {YOUR_AUTH_KEY}',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

response = requests.request('GET', url, headers=headers)
response.json()
```

#### Respostas

**200 — Sucesso:**
```json
{
    "status": "success",
    "data": {
        "id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
        "payment_id": "01H8X9V8X9Y8Z9A8B8C8D8E8F8",
        "amount": 50.00,
        "status": "completed",
        "reason": "Customer requested refund",
        "payment": {...}
    }
}
```

**404 — Não encontrado:**
```json
{
    "status": "error",
    "message": "Refund not found."
}
```

---

## 9. Recursos Adicionais

| Recurso | Link |
|---------|------|
| Colecção Postman | https://paysuite.tech/docs/collection.json |
| Especificação OpenAPI (YAML) | https://paysuite.tech/docs/openapi.yaml |
| Dashboard do Merchant | https://paysuite.tech |
| Documentação gerada por | [Scribe](http://github.com/knuckleswtf/scribe) |

---

> **Nota sobre `docs.paysuite.co.mz`:** Existe uma documentação complementar em https://docs.paysuite.co.mz voltada para integração via painel do merchant, formulário de pagamento, link de pagamento e API. Esta documentação está parcialmente inacessível (retornou 404 em algumas rotas e 403 para o endpoint da API em paysuite.co.mz).

---

*Documentação compilada com fidelidade máxima ao conteúdo original de https://paysuite.tech/docs/*
