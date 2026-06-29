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
                                          └─ LXC 109 «family-planner», IP 10.10.10.9
                                                  └─ Docker Compose: app (Go) + postgres
```

- Сеть Proxmox: bridge `vmbr1`, подсеть `10.10.10.0/24`, gateway `10.10.10.1`.
- Адреса `10.10.10.x` — приватные (RFC1918), наружу не торчат; снаружи доступен только хост и порты, которые отдаёт NPM.

## Доступ к Proxmox и контейнеру

- Хост Proxmox: `ssh root@<PROXMOX_HOST_IP>`, web-UI `https://<PROXMOX_HOST_IP>:8006`, узел `OriginBase`.
- Контейнер LXC 109 напрямую с Mac недоступен (приватная сеть). Заход — **через jump-host**:
  ```bash
  ssh -J root@<PROXMOX_HOST_IP> root@10.10.10.9
  ```
  Ключ `fp-mk-key` должен быть в ssh-agent; для git-операций внутри контейнера заходить с `-A`
  (agent forwarding), чтобы push/pull шли твоим ключом без хранения ключей на сервере.
- С самого хоста Proxmox: `pct enter 109` или `pct exec 109 -- <cmd>`.

## Параметры LXC 109

- Ubuntu 24.04 LTS, **privileged**, **nesting=1** (без nesting Docker в LXC не стартует).
- Hostname `family-planner`, IP `10.10.10.9/24`, gw `10.10.10.1`, bridge `vmbr1`, static.
- Создан через community-scripts (ProxmoxVE helper, `ct/ubuntu.sh`). Публичный SSH-ключ инжектирован при создании.
- Создаётся пустой Ubuntu — Docker и приложение ставятся вручную (см. ниже).

## ⚠️ Обязательный фикс: Docker внутри LXC

Без него контейнеры не стартуют — runc падает на
`open sysctl net.ipv4.ip_unprivileged_port_start: permission denied`.
Решение — снять AppArmor для контейнера. На **хосте Proxmox** в `/etc/pve/lxc/109.conf` добавить:
```
lxc.apparmor.profile: unconfined
```
затем `pct stop 109 && pct start 109`. После этого `docker run hello-world` работает.
(Сообщение про "overrides features:nesting" при старте — нормально.)

## Установка Docker в контейнере
```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

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
- Всё в Docker Compose внутри LXC 109; наружу — через NPM.

## Деплой (черновик, детализируем при реализации)
1. Зайти в контейнер через jump-host, поставить Docker + Compose.
2. `git clone` репозитория (через agent forwarding или deploy-key).
3. Секреты (`.env`, токен бота, креды БД) — **не из git**, завести на месте.
4. `docker compose up -d --build`; volume для Postgres создать заранее.
5. Прокинуть домен через NPM → `10.10.10.9:<APP_PORT>`, выпустить LE-сертификат.
