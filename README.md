# CardForge（card-forge）

Markdown 格式角色卡与 chara_card_v2/v3 标准卡的通用读写 CLI 工具。Node ESM，零外部依赖，只用 node 内置模块。编卡理念参考 Nika-Character-Studio（v2/v3 规范兼容、世界书条目归一化思路），代码独立实现，模块化拆分。

## 项目简介

CardForge 是一个命令行角色卡工具箱，支持：

- **inspect**：解卡。识别 JSON 角色卡（chara_card_v2/v3）、Markdown 结构卡、纯世界书、纯文本卡，输出结构清单、字段完整性、规模统计与异常项。
- **forge**：写卡。从命令行参数生成标准 `chara_card_v3`（spec_version 3.0）JSON。
- **convert**：转换。Markdown 结构卡 ↔ 标准卡 JSON 双向转换。

## 安装

无需安装，Node.js ≥ 18 直接跑。

## 用法

### 1. 解卡 inspect

```
node cardforge.js inspect <文件>
```

支持三类文件：
- `.json`：酒馆角色卡（chara_card_v2/v3），自动判断 spec、统计 character_book 条目、检查字段完整性
- `.md`：Markdown 结构卡，提取版本头/人设段/身份段/行为边界/自愈条等段落结构
- `.txt`：纯文本卡，基础规模统计

输出 JSON 报告：卡类型识别、结构清单、字段完整性（missing/present）、规模统计、异常项（缺字段/空字段/BOM/格式错）。

示例输出字段说明：
- `cardType`: `stv3` / `stv2` / `md-card` / `worldbook` / `invalid-json` 等
- `completeness.missing`: 缺失的 v3 核心字段
- `issues`: 异常清单（spec 缺失、空 content 条目、BOM、spec_version 不是 3.0 等）

### 2. 写卡 forge

```
node cardforge.js forge --out xxx.json --name 名称 --desc 描述 --personality 人设 --scenario 场景 --first-meeting 开场白 [--book 世界书.json]
```

生成标准 `chara_card_v3`（spec_version 3.0），data 含 name/description/personality/scenario/first_mes/mes_example/creator_notes/system_prompt/character_book 等全部标准字段。世界书文件支持 `{entries:[...]}` 格式。

其余可选参数：`--mes-example`、`--system-prompt`、`--creator-notes`、`--creator`、`--tags a,b`、`--character-version`。

### 3. 转换 convert

```
node cardforge.js convert <输入> --out <输出>
```

- `.md -> .json`：Markdown 结构卡映射到 v3 字段。映射规则：
  - 卡名 -> `data.name`
  - 定位/核心理念/身份段 -> `data.description`
  - 人设段 -> `data.personality`
  - 行为边界段 -> `data.scenario`
  - 身份段同时写入 `data.system_prompt`
  - 自愈条 + 行为边界 -> `character_book.entries`（常驻条目，constant=true）
  - 版本头 -> `data.creator_notes`
- `.json -> .md`：v3 卡生成 md 概要（含标题、描述、人设、场景、开场白、系统提示词、世界书条目摘要，长内容截断）。

## 测试

```
node test.mjs
```

覆盖 inspect（v3卡/坏卡/纯世界书）、forge（基础/带世界书/读回验证）、convert（Markdown 结构卡双向转换）与 parseMd 单元测试，共 31 项，全绿通过。

## 文件结构

```
card-forge/
  cardforge.js      CLI 入口（inspect/forge/convert 三命令）
  lib/
    inspect.js      解卡核心（类型识别/完整性/异常）
    parseMd.js      Markdown 结构卡段落解析
    forge.js        v3 卡生成 + 世界书条目归一化
    convert.js      md<->json 双向转换
  test.mjs          自测（31 用例）
  README.md         本文件
  LICENSE           MIT License
```

## 设计原则

- 零依赖：只用 node 内置 fs/path/child_process
- 模块化：lib/ 四个文件各管一件事，CLI 只是壳
- 宽容解析：BOM 自动剥除、v2/v3/裸字段卡都能读，问题进 issues 不抛异常
- 启发式识别：md 卡按标题关键词（人设段/行为边界/自愈条）识别段落，不绑死单一卡模板

## License

MIT，详见 [LICENSE](./LICENSE)。
