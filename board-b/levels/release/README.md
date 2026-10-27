# 生产包尚未生成

当前 12 句真实注意力样例均为 `draft`，仅用于技术验收与集成测试。

生产构建必须满足：

- 每句 `review.status = approved`
- 每句具有审核人和审核日期
- 关卡包 `status = release`

在没有内容负责人签字前，不要删除此说明，也不要把 draft 数据复制成 release 包。
