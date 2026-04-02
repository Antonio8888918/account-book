# 云端中文记账网页工具

这是一个基于 `Vite + 原生 HTML/CSS/JavaScript + Supabase` 的记账应用。  
它支持邮箱注册、登录、退出登录、密码重置，以及每位用户独立的云端记账数据。

## 项目文件

- `index.html`
  - 页面入口，包含认证视图和登录后的记账主界面。
- `styles.css`
  - 页面样式，复用了原来的卡片式布局，并新增登录、状态提示、用户栏样式。
- `package.json`
  - 项目依赖和运行脚本，使用 `vite` 和 `@supabase/supabase-js`。
- `.env.example`
  - 环境变量模板，告诉你需要配置哪些 `Supabase` 参数。
- `src/main.js`
  - 应用入口，负责登录态切换、注册、登录、退出登录、密码重置。
- `src/app.js`
  - 记账主逻辑，负责交易记录的新增、查询、编辑、删除、筛选和统计。
- `src/constants.js`
  - 统一存放分类、支付方式、币种等常量。
- `src/supabase.js`
  - 初始化 `Supabase` 客户端，并读取环境变量。
- `supabase/schema.sql`
  - 数据库建表和 RLS 权限策略。

## 第一版已实现功能

- 邮箱 + 密码注册
- 邮箱 + 密码登录
- 退出登录
- 忘记密码邮件发送
- 点击邮件链接后设置新密码
- 登录后进入记账主页面
- 每个用户新增、查看、编辑、删除自己的记账记录
- 按日期、类型、分类、币种筛选
- 本月收入、本月支出、当前结余统计
- `RUB / CNY` 分开统计，不做汇率换算

## Supabase 需要创建哪些表

### `transactions`

当前项目已经按这个表结构编写：

```sql
id uuid primary key
user_id uuid not null
date date not null
type text not null
amount numeric(12, 2) not null
category text not null
note text
payment_method text not null
currency text not null
created_at timestamptz not null
```

### `profiles`

第一版不是必须，所以当前没有强制依赖。

适合以后再加的场景：

- 保存昵称
- 保存头像
- 保存默认币种
- 保存更多用户偏好

## 用户数据隔离怎么做

项目不是只靠前端“按用户过滤”，而是靠数据库权限真正隔离。

`supabase/schema.sql` 已经做了这些事：

- `transactions.user_id` 默认取 `auth.uid()`
- 开启 `Row Level Security`
- 只有已登录用户可访问
- `select / insert / update / delete` 都只允许操作自己的记录

这意味着即使用户打开浏览器开发者工具，也不能越权读取别人的账本。

## 如何配置 Supabase

### 1. 创建项目

在 [Supabase](https://supabase.com/) 创建一个新项目。

### 2. 运行 SQL

打开 Supabase Dashboard：

1. 进入 `SQL Editor`
2. 打开项目中的 `supabase/schema.sql`
3. 整段执行

执行后就会创建 `transactions` 表和对应的 RLS 策略。

### 3. 开启邮箱密码登录

进入：

- `Authentication`
- `Providers`

确认 `Email` 已启用。

### 4. 配置站点地址和跳转地址

进入：

- `Authentication`
- `URL Configuration`

开发阶段建议填写：

- `Site URL`: `http://localhost:5173`
- `Redirect URLs`:
  - `http://localhost:5173`
  - 你的 Vercel 正式域名，例如 `https://your-app.vercel.app`

这样注册确认邮件和密码重置邮件才能正确跳回你的网页。

## 如何填写环境变量

在 Supabase 项目设置里找到：

- `Project URL`
- `anon public key`

然后在项目根目录新建 `.env`：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

说明：

- 必须使用 `VITE_` 前缀，因为 Vite 只会把 `VITE_*` 变量暴露给前端代码
- `anon key` 可以公开放在前端；真正的数据安全依赖 RLS

## 如何本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

### 3. 打开浏览器

访问终端里显示的地址，通常是：

```text
http://localhost:5173
```

## 如何部署到 Vercel

### 方案一：推荐，用 Git 仓库部署

1. 把项目上传到 GitHub
2. 登录 [Vercel](https://vercel.com/)
3. 点击 `Add New Project`
4. 导入你的 GitHub 仓库
5. Framework 选择 `Vite`
6. Build Command 保持默认或填写 `npm run build`
7. Output Directory 保持默认 `dist`

### 方案二：用 Vercel CLI

```bash
npm i -g vercel
vercel
```

### 在 Vercel 中配置环境变量

部署前或部署后都可以在项目设置里添加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

保存后重新部署一次。

## 上线后如何让朋友注册并使用

1. 把你的 Vercel 域名发给朋友
2. 朋友打开网页后点击“注册”
3. 输入邮箱和密码完成注册
4. 如果你的 Supabase 开启了邮箱确认，朋友需要先去邮箱点击确认链接
5. 返回网页登录后，就能开始使用自己的账本

每个用户只会看到自己的数据，因为数据库已经做了行级权限隔离。

## 后续如果要继续开发

### 1. 增加预算功能

建议优先修改：

- `src/app.js`
- `supabase/schema.sql`

可以新增一张 `budgets` 表，例如：

```sql
id uuid primary key
user_id uuid not null
month text not null
category text not null
currency text not null
amount numeric(12, 2) not null
created_at timestamptz not null
```

然后在 `src/app.js` 的统计区域里增加预算展示。

### 2. 导出 CSV / Excel

建议优先修改：

- `src/app.js`

最容易先做的是 CSV：

- 增加一个“导出 CSV”按钮
- 把当前用户的记录数组转成文本
- 用 `Blob` 触发下载

如果后面要做 Excel：

- 可以引入 `SheetJS`
- 但建议等 MVP 稳定后再加

## 适合初学者继续看的几个文件

- 页面结构：`index.html`
- 页面样式：`styles.css`
- 登录和认证：`src/main.js`
- 记账 CRUD 和统计：`src/app.js`
- Supabase 客户端：`src/supabase.js`
- 数据库结构：`supabase/schema.sql`
