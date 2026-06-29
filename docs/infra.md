# Инфраструктура и деплой — family-planner

> Выжимка переиспользуемых знаний (из предыдущего проекта на этом же Proxmox) + параметры
> нового контейнера. **Секреты здесь не хранятся** — публичный IP хоста и пароли заменены
> плейсхолдерами; реальные значения лежат локально в `private/secrets.md` (не в git).

## Топология

```
Интернет → домен (Cloudflare DNS) → Proxmox host <PROXMOX_HOST_IP>
                                          │
                                          ├─ NPM (Nginx Proxy Manager), CT, IP 10.10.10.2  ← TLS / Let's Encrypt
                                          │       проксирует домен → http://10.10.10.9:<APP_PORT>
                                          │
                                          └─ LXC 107 «family-planner», IP 10.10.10.9
                                                  └─ Docker Compose: app (Go) + postgres
```

- Сеть Proxmox: bridge `vmbr1`, подсеть `10.10.10.0/24`, gateway `10.10.10.1`.
- Адреса `10.10.10.x` — приватные (RFC1918), наружу не торчат; снаружи доступен только хост и порты, которые отдаёт NPM.

## Доступ к Proxmox и контейнеру

- **Хост Proxmox** (узел `OriginBase`, Selectel): `ssh root@<PROXMOX_HOST_IP>` — ключ
  `selectel_origin_base`. Web-UI: `https://<PROXMOX_HOST_IP>:8006`.
- **LXC 107** во внутренней сети (`10.10.10.9`) напрямую с Mac недоступен. Самый простой вход —
  с хоста: `pct enter 107` или `pct exec 107 -- <cmd>`.
- Вариант с **jump-host** (если нужен прямой ssh в контейнер): host-хоп идёт по
  `selectel_origin_base`, хоп host→контейнер — по ключу контейнера (`fp-mk-key`):
  ```bash
  ssh -J root@<PROXMOX_HOST_IP> root@10.10.10.9
  ```
- Для git внутри контейнера заходить с `-A` (agent forwarding), чтобы `push/pull` шли твоим
  GitHub-ключом без хранения ключей на сервере.

> ⚠️ **Telegram API недоступен с этого хоста.** С РФ/Selectel-хоста `api.telegram.org`
> заблокирован — бот не сможет ходить в Telegram Bot API напрямую из LXC. Все исходящие к
> Telegram делать асинхронно, с таймаутом, через внешний прокси / облачный сервис (не на этом
> хосте). Это нужно учесть в архитектуре бота. Детали урока — в `private/proxmox-notes.md`.

## Параметры LXC 107

> ⚠️ Реальный CTID контейнера family-planner — **107** (community-scripts назначил следующий
> свободный ID). В ранних заметках фигурировал «109» — это ошибка, везде читать 107.

- Ubuntu 24.04.4 LTS, **privileged**, **nesting=1** (без nesting Docker в LXC не стартует).
- Hostname `family-planner`, IP `10.10.10.9/24`, gw `10.10.10.1`, bridge `vmbr1`, static.
- Создан через community-scripts (ProxmoxVE helper, `ct/ubuntu.sh`). Публичный SSH-ключ инжектирован при создании.
- Создаётся пустой Ubuntu — Docker и приложение ставятся вручную (см. ниже).

## ⚠️ Обязательный фикс: Docker внутри LXC — ✅ ПРИМЕНЁН (107)

Без него контейнеры не стартуют — runc падает на
`open sysctl net.ipv4.ip_unprivileged_port_start: permission denied`.
Решение — снять AppArmor для контейнера. На **хосте Proxmox** в `/etc/pve/lxc/107.conf` добавить:
```
lxc.apparmor.profile: unconfined
```
затем `pct stop 107 && pct start 107`. После этого `docker run hello-world` работает.
(Сообщение `explicitly configured lxc.apparmor.profile overrides ... features:nesting` при старте — нормально.)

> ✅ **Сделано:** строка добавлена в `107.conf` (бэкап — `107.conf.bak` на хосте), контейнер
> перезапущен, IP `10.10.10.9` сохранён. Та же строка работает на соседнем LXC 106 (coinshop).

## Установка Docker в контейнере — ✅ СДЕЛАНО (107)
```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```
> ✅ **Установлено в 107:** Docker **29.6.1**, Compose **v5.2.0**; `docker run hello-world` — OK;
> сервис `docker` enabled + active.

## Reverse proxy (NPM)

Внешний прокси уже есть в Proxmox — отдельный **Nginx Proxy Manager** (CT, `10.10.10.2`).
Свой nginx внутри compose для MVP не нужен: NPM сам терминирует TLS и проксирует домен на контейнер.

Proxy Host в NPM (когда дойдём до публикации):
- Domain: `<домен приложения>`, scheme `http`, forward `10.10.10.9:<APP_PORT>`.
- SSL: Let's Encrypt, Force SSL ON (после выпуска cert), HTTP/2 ON.
- Cloudflare DNS на этапе выпуска LE-сертификата держать **серым облаком** (DNS only) — оранжевое
  ломает HTTP-01 challenge.

## Стек приложения (по ТЗ, docs/spec.md)
- Backend: Go (Telegram-бот + REST API), Telegram Bot API через `go-telegram-bot-api`.
- БД: PostgreSQL (отдельный Docker volume), миграции — goose/golang-migrate/atlas.
- Frontend: SPA (React/Vue/Svelte), статика отдаётся через backend или отдельный контейнер.
- Всё в Docker Compose внутри LXC 107; наружу — через NPM.

## Деплой (черновик, детализируем при реализации)
1. Зайти в контейнер через jump-host, поставить Docker + Compose.
2. `git clone` репозитория (через agent forwarding или deploy-key).
3. Секреты (`.env`, токен бота, креды БД) — **не из git**, завести на месте.
4. `docker compose up -d --build`; volume для Postgres создать заранее.
5. Прокинуть домен через NPM → `10.10.10.9:<APP_PORT>`, выпустить LE-сертификат.
