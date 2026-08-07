# Web SSH Terminal（MVP）

**Version：v1.0**

---

# 1. 项目目标

开发一个轻量级 Web SSH 工具。

部署到一台拥有 SSH 私钥的 Linux 服务器后，团队成员通过浏览器访问，即可打开已经配置好的 Linux 服务器终端。

整个系统定位：

> **团队内部使用的小工具，而不是堡垒机。**

---

# 2. 用户故事

团队已经有一台运维服务器：

```text
Web Server
```

Web Server 保存：

```text
~/.ssh/id_ed25519
~/.ssh/id_ed25519.pub
```

随后把：

```text
id_ed25519.pub
```

分别加入目标服务器：

例如：

```text
Server A

/home/bddf/.ssh/authorized_keys
```

```text
Server B

/home/zorth/.ssh/authorized_keys
```

```text
Server C

/root/.ssh/authorized_keys
```

部署 Web 应用。

团队成员：

```
浏览器
↓

登录 Web

↓

选择服务器

↓

打开 Terminal

↓

直接获得 Shell
```

无需：

* SSH Client
* SSH Key
* Terminal 软件

---

# 3. MVP 范围

## 必做

✅ 登录

✅ Server 管理

✅ Web Terminal

✅ SSH

✅ 多 Terminal

✅ Docker

---

## 不做

❌ RBAC

❌ 用户管理

❌ 操作审计

❌ 文件上传

❌ 文件下载

❌ 批量命令

❌ SSH Key 管理

❌ 多 SSH Key

❌ Jump Server

❌ SFTP

❌ HA

---

# 4. 用户模型

MVP 只有：

```
一个 Web 登录账号
```

例如：

```
admin
******
```

所有团队成员共用。

系统没有：

* 用户列表
* 用户管理
* 权限管理

---

# 5. Server 配置

数据库保存：

| 字段       | 说明       |
| -------- | -------- |
| name     | 名称       |
| host     | IP / 域名  |
| port     | SSH Port |
| username | SSH 用户   |
| remark   | 备注       |

例如：

| Name | Host        | Username |
| ---- | ----------- | -------- |
| API  | 10.0.0.11   | bddf     |
| DB   | 10.0.0.12   | root     |
| Dev  | dev.xxx.com | zorth    |

这里：

```
username
```

决定 SSH 登录用户。

例如：

Server A：

```
bddf@10.0.0.11
```

Server B：

```
root@10.0.0.12
```

Server C：

```
zorth@dev.xxx.com
```

---

# 6. SSH 模型

平台只保存：

```
一个 SSH Private Key
```

例如：

```
/run/secrets/ssh_key
```

不会：

* 上传 Key
* 编辑 Key
* 保存数据库
* 返回浏览器

所有 SSH 登录：

```
Web Server

↓

SSH Private Key

↓

Server.username

↓

Linux Server
```

---

# 7. 技术栈

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* xterm.js

---

## Backend

* Next.js
* Socket.IO
* ssh2

---

## Database

SQLite

Prisma

---

## Auth

Auth.js

Credentials Provider

---

# 8. 系统架构

```text
                 Browser
                     │
        ┌────────────┴────────────┐
        │                         │
    HTTP(API)                Socket.IO
        │                         │
        ▼                         ▼

    Next.js Route          Terminal Session

                │

                ▼

             ssh2

                │

      Shared SSH Private Key

                │

      Linux Server Shell
```

---

# 9. Terminal 工作流程

用户：

```
点击

↓

打开终端
```

后台：

```
Socket.IO

↓

验证登录

↓

查询 Server

↓

读取：

host

port

username

↓

ssh2.connect()

↓

request PTY

↓

Interactive Shell
```

随后：

```
Keyboard

↓

Socket.IO

↓

SSH stdin
```

服务器输出：

```
stdout

↓

Socket.IO

↓

xterm.js
```

---

# 10. Terminal Session

每一个 Terminal：

```
一个 Socket

↓

一个 SSH Connection

↓

一个 PTY
```

例如：

```
Terminal 1

↓

Server A
```

```
Terminal 2

↓

Server B
```

互不影响。

后台：

```
TerminalSessionManager
```

维护：

```
Map

socketId

↓

TerminalSession
```

---

# 11. 数据模型

## Server

```text
id

name

host

port

username

remark

createdAt

updatedAt
```

---

# 12. API

```
POST /login
POST /logout
```

```
GET /api/servers

POST /api/servers

PUT /api/servers/:id

DELETE /api/servers/:id
```

---

# 13. 页面

## Login

```
Username

Password

[ Login ]
```

---

## Server List

```
Server A

bddf@10.0.0.11

[Open]

[Edit]

[Delete]
```

```
Server B

root@10.0.0.12

[Open]
```

---

## Terminal

```
+-----------------------------+

Server A

-------------------------------

root@server

$

```

支持：

* 多标签

* 全屏

---

# 14. Docker

```yaml
services:

  web:

    build: .

    ports:

      - "3000:3000"

    volumes:

      - ./data:/app/data

      - /root/.ssh/id_ed25519:/run/secrets/ssh_key:ro

      - /root/.ssh/known_hosts:/run/secrets/known_hosts:ro

    environment:

      DATABASE_URL=file:/app/data/app.db

      AUTH_SECRET=xxxx

      SSH_PRIVATE_KEY_PATH=/run/secrets/ssh_key

      SSH_KNOWN_HOSTS_PATH=/run/secrets/known_hosts
```

---

# 15. MVP 验收标准

完成以下功能即视为 MVP 完成：

### 登录

* 可以登录
* 未登录无法访问系统

---

### Server

* 新增服务器
* 编辑服务器
* 删除服务器
* 查看服务器列表

---

### Terminal

点击：

```
Open
```

能够：

```
SSH 成功

↓

获得 Shell

↓

输入命令

↓

看到输出
```

例如：

```bash
pwd

ls

cd

cat

tail
```

均可正常工作。

---

### Interactive

以下命令正常：

```
vim

top

less
```

窗口大小变化后：

```
PTY Resize
```

正常同步。

---

### Docker

执行：

```bash
docker compose up -d
```

即可启动整个系统。

---

# 16. 后续版本（V2）

MVP 完成后，再逐步增加：

* 多个 Web 账号
* RBAC
* 操作审计
* Terminal Recording
* SFTP 文件管理
* 批量命令执行
* 多 SSH Key
* SSH 凭据管理
* Jump Server
* 操作历史
* 收藏服务器
* 标签/分组

---

## 我还有两个建议（我认为会让这个项目更有产品感）

### 1. 不要叫「Web SSH」

这个名字太普通了。

可以考虑：

* **TermHub**
* **WebTerm**
* **OpsTerm**
* **TermGate**
* **ShellDeck**
* **TinySSH**

以后如果开源，辨识度会高很多。

### 2. 第一版再加一个几乎零成本但体验很好的功能

在服务器列表里增加一个**在线状态检测**。

例如：

```text
🟢 API-01
bddf@10.0.0.11

🟢 DB-01
root@10.0.0.12

🔴 Dev-01
zorth@10.0.0.13
```

启动时或每隔几十秒后台尝试建立一个短连接（或 TCP 检测 22 端口），就能让用户一眼知道服务器是否可达。这个开发成本很低，但产品体验会提升不少，也是很多同类工具都会提供的能力。

