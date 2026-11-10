# 零停机发布 / Zero-downtime deploy

`scripts/deploy.sh` 在新目录里安装依赖并构建，旧进程继续对外服务。构建成功后才切换 `/opt/aisubscr-current` 并重启。健康检查未通过时自动切回上一版。

脚本**不会**执行 `npm run db:seed`、`npm run db:setup`、`npx prisma db seed`、`prisma db push` 或 `prisma migrate reset`，也**不会**删除上传文件或数据库文件。

The same rules in English: the script builds in a new directory while the old process keeps serving, switches a symlink, and switches back when `/api/health` does not report the new commit. It never seeds the database and never deletes uploads.

## 目录 / Layout

```
/opt/aisubscr-shared/.env
/opt/aisubscr-shared/production.db      # 以及旁边的 -wal / -shm
/opt/aisubscr-shared/uploads/           # 原来的 public/uploads
/opt/aisubscr-shared/release.env        # 脚本写入 GIT_COMMIT，不要手改
/opt/aisubscr-releases/<40位 sha>/      # 一次发布一个目录
/opt/aisubscr-current -> 上面的某个发布目录
```

每个发布目录里这三处是符号链接，不是拷贝：

- `.env` → `/opt/aisubscr-shared/.env`
- `prisma/production.db` → `/opt/aisubscr-shared/production.db`
- `public/uploads` → `/opt/aisubscr-shared/uploads`

`DATABASE_URL` 建议写成绝对路径，这样不依赖进程的工作目录：

```
DATABASE_URL="file:/opt/aisubscr-shared/production.db"
```

相对路径 `file:./prisma/production.db` 也能用，因为链接就在发布目录的 `prisma/` 下。SQLite 的 WAL 文件跟真实数据库文件放在一起，不要把 WAL 单独留在旧目录。

## 一次性切换 / One-time cutover

现有服务的工作目录是 `/opt/aisubscr`。先做这一次短暂停机，把数据和 systemd 指到共享目录与符号链接。之后的发布才由 `deploy.sh` 负责。这一步要在服务器上手动做，仓库里的脚本不会改正在运行的机器。

1. 看一眼备份任务。仓库里的 `deploy/backup.sh` 默认备份 `/opt/aisubscr-shared/production.db`。服务器上的 `/usr/local/sbin/aisubscr-backup` 如果还指向旧路径，改到新路径后再继续。
2. 停服务，让 SQLite 写完 WAL：

   ```bash
   systemctl stop aisubscr
   ```

3. 挪走数据（不要复制一半就删掉原文件；`mv` 同一块磁盘上是改名）：

   ```bash
   mkdir -p /opt/aisubscr-shared
   mv /opt/aisubscr/.env /opt/aisubscr-shared/.env
   mv /opt/aisubscr/prisma/production.db /opt/aisubscr-shared/production.db
   mv /opt/aisubscr/prisma/production.db-wal /opt/aisubscr-shared/production.db-wal 2>/dev/null || true
   mv /opt/aisubscr/prisma/production.db-shm /opt/aisubscr-shared/production.db-shm 2>/dev/null || true
   mv /opt/aisubscr/public/uploads /opt/aisubscr-shared/uploads
   ```

4. 把 `DATABASE_URL` 改成上面的绝对路径。确认 `.env` 权限仍是 `0600`，属主是运行服务的用户。
5. 用仓库里的 `deploy/aisubscr.service` 更新 `/etc/systemd/system/aisubscr.service`。关键三项：

   ```
   WorkingDirectory=/opt/aisubscr-current
   EnvironmentFile=/opt/aisubscr-shared/.env
   EnvironmentFile=-/opt/aisubscr-shared/release.env
   ExecStart=/usr/bin/node /opt/aisubscr-current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
   ```

   `release.env` 前面的 `-` 表示文件还不存在时忽略。`deploy.sh` 会在重启前写上 `GIT_COMMIT`。
6. 先让符号链接指向还没换掉的旧代码，服务可以马上起来：

   ```bash
   ln -s /opt/aisubscr /opt/aisubscr-current
   systemctl daemon-reload
   systemctl start aisubscr
   ```

7. 旧目录里的 `.env`、数据库、上传目录已经挪走。在旧目录补上同样的三条符号链接，否则这次启动读不到它们：

   ```bash
   ln -s /opt/aisubscr-shared/.env /opt/aisubscr/.env
   ln -s /opt/aisubscr-shared/production.db /opt/aisubscr/prisma/production.db
   ln -s /opt/aisubscr-shared/uploads /opt/aisubscr/public/uploads
   systemctl restart aisubscr
   ```

8. 若这台库还没执行过 baseline 的 `migrate resolve`，先按 README「生产数据库升级」做完那一次。`deploy.sh` 不会代跑 `migrate resolve`。

确认 `curl -fsS http://127.0.0.1:3000/api/health` 返回 `"ok":true` 后再做第一次脚本发布。

## 每次发布 / Every release

在服务器的 git 检出里（默认就是仓库根目录）：

```bash
sudo bash scripts/deploy.sh --ref origin/main
```

常用参数：

| 参数 | 作用 |
|------|------|
| `--ref <git-ref>` | 要发布的提交，默认 `HEAD` |
| `--repo <path>` | git 检出目录，默认是脚本所在仓库 |
| `--no-fetch` | 不执行 `git fetch` |

也可以用环境变量改路径：`RELEASES_DIR`、`CURRENT_LINK`、`SHARED_DIR`、`ENV_FILE`、`DB_FILE`、`UPLOADS_DIR`、`SERVICE`、`HEALTH_URL`。

脚本顺序：

1. 确认 systemd 的 `WorkingDirectory`、`ExecStart` 和 `EnvironmentFile` 已经指向符号链接和共享文件。不符合就退出，不改动线上进程。
2. `git fetch`（除非 `--no-fetch`），解析出 40 位提交号。
3. 把该提交解包到 `/opt/aisubscr-releases/<sha>/`，接上三条符号链接。
4. 在新目录执行 `npm ci` 和 `npm run build`。这一段旧进程继续监听 3000。
5. `npx prisma migrate status`。没有待执行迁移时**不**停服务。输出里出现尚未应用的迁移时，才 `systemctl stop`，然后只跑 `npx prisma migrate deploy`。
6. 原子替换 `/opt/aisubscr-current`，写入 `release.env` 的 `GIT_COMMIT`，`systemctl restart`。
7. 最多约 30 秒轮询 `GET /api/health`。`ok` 与 `db` 必须为 `true`，且 `commit` 等于这次的提交号。
8. 健康检查失败：符号链接和 `release.env` 改回上一版并再次重启。迁移本身不会自动回滚（只加列的迁移旧代码仍能读）。
9. 成功后删掉更旧的发布目录，但留下当前和上一版。若某个旧目录里的 `public/uploads` 或数据库是真实文件而不是符号链接，脚本会留下它并打印原因。

非 root 运行时用 `sudo -n systemctl`，需要免密 sudo。同一时间第二份 `deploy.sh` 会因为锁文件退出。

构建失败、迁移失败时，若服务曾被停下，脚本会把它拉起来并保持旧的符号链接。

## 不要做的事 / Do not

- 不要在生产跑 seed 或 `db:setup`。那会重置管理员密码。
- 不要删除 `/opt/aisubscr-shared/uploads` 或 `production.db`。
- 不要在发布目录里放上传文件的实体拷贝。脚本发现这种情况会停止，避免把用户文件清掉。
- 健康检查走的是本机 `127.0.0.1:3000`，不经过页面缓存。`GIT_COMMIT` 必须由 `release.env` 注入，否则 `commit` 为 `null`，脚本会判定失败并切回。
