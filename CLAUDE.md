# CLAUDE.md — family-planner

Гайд для работы над проектом. Читается в начале каждой сессии.

## Что это за проект
Семейный планировщик для двух пользователей (муж и жена): общий список задач, календарь,
встречи и напоминания.

**Архитектура (ADR-001, см. `docs/architecture.md`) — модель Telegram Mini App:**
1. **Telegram-бот** — минимальный лаунчер: кнопка в @BotFather открывает Mini App. Без команд (MVP).
2. **Frontend (Mini App, SPA)** — основной интерфейс, открывается внутри Telegram с нашего домена.
   Сюда фокус разработки.
3. **Backend (Go) + PostgreSQL** — REST API, авторизация через Telegram `initData` (валидация
   HMAC локально, allowlist на двоих), сессии, общее семейное пространство.
4. **Уведомления** — исходящие в Telegram через **облачный n8n** (с хоста `api.telegram.org`
   заблокирован; см. `docs/infra.md`). Приём апдейтов в MVP не нужен.

Документы: исходное ТЗ — `docs/spec.md` (часть решений пересмотрена), решения — `docs/architecture.md`.

## Стек (по ТЗ)
- Backend: **Go** (REST API + Telegram-бот, `go-telegram-bot-api`).
- БД: **PostgreSQL** (отдельный Docker volume), миграции — goose / golang-migrate / atlas.
- Frontend: SPA (React/Vue/Svelte).
- Инфра: **Docker Compose** внутри **Proxmox LXC 109**, наружу через **Nginx Proxy Manager**.
- Детали инфры и деплоя: `docs/infra.md`.

## 🔴 Правила работы (важно, соблюдать всегда)
1. **Документировать шаги.** Любые предпринятые действия фиксируем (в этом файле, в `docs/`
   или в описании коммита), чтобы к ним можно было вернуться и поправить.
2. **Подтверждение на изменения.** Действия создания/изменения (правка файлов, git-операции
   с записью, изменения на сервере) — выполняются **только после явного «да»**. Действия
   чтения/просмотра (ls, cat, git status, docker ps, SELECT и т.п.) — сразу, без спроса.
3. **Объяснять «почему».** Проект учебный: помимо самого действия давать объяснение, почему
   сделано именно так (цель — отточить навыки современной разработки).

## 🔐 Секреты и публичный репозиторий
- Репозиторий **публичный** (`git@github.com:EestiChameleon/family-planner.git`).
  **Никаких секретов в git.**
- Всё чувствительное и «обсуждательное» — в папке **`private/`** (она в `.gitignore`):
  SSH-ключи, реальные IP/пароли (`private/secrets.md`), старые заметки.
- В коммитимых доках реальные публичный IP хоста и пароли — **плейсхолдерами**
  (`<PROXMOX_HOST_IP>`, `<LXC_ROOT_PASSWORD>`), маппинг — в `private/secrets.md`.
- Перед коммитом проверять: `git status` + `git ls-files` — секретов и `private/` быть не должно.
- Внутренние адреса `10.10.10.x` (RFC1918) — не секрет, их в доках оставляем.

## Структура репозитория
```
family-planner/
├── CLAUDE.md             # этот файл
├── .gitignore
├── docs/
│   ├── spec.md           # исходное ТЗ (часть решений пересмотрена — см. architecture.md)
│   ├── architecture.md   # архитектурные решения (ADR), приоритет над spec.md
│   └── infra.md          # инфраструктура и деплой (без секретов)
└── private/              # В .gitignore — только локально, в git НЕ уходит
    ├── fp-mk-key(.pub)   # SSH-ключ LXC 109
    ├── secrets.md        # реальные IP/пароли/ключи
    ├── tg-data.md        # bot token, allowlist, заметки по Telegram/n8n
    └── proxmox-109-lxc.md# лог создания LXC 109 (+ proxmox-notes.md — уроки coinshop)
```

## Git
- origin: `git@github.com:EestiChameleon/family-planner.git`
- Доступ — по SSH-ключу. Push делается по подтверждению (см. правило №2).

## Доступ к серверу (кратко; детали и реальные значения — в private/)
```bash
ssh -J root@<PROXMOX_HOST_IP> root@10.10.10.9   # LXC 109, family-planner
```

## Текущий статус
- [x] Папка связана с git-репо, секреты вынесены в `private/`, документация выжата.
- [x] Архитектура зафиксирована (ADR-001: модель Telegram Mini App), ТЗ синхронизировано.
- [x] LXC 109 создан (Ubuntu 24.04).
- [ ] Разработка переходит в **Claude Code** (код backend/frontend в репозитории).
- [ ] Инфра: фикс Docker-в-LXC (`109.conf` → `lxc.apparmor.profile: unconfined`), установка Docker.
- [ ] Backend: структура Go-проекта, схема БД, миграции, валидация initData, сессии.
- [ ] Frontend: Mini App (SPA). Бот: кнопка-лаунчер в @BotFather. Уведомления через облачный n8n.
- [ ] Деплой через NPM (домен → `10.10.10.9:<APP_PORT>`, Let's Encrypt).
