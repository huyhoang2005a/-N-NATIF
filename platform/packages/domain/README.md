# @r2m/domain — shared kernel

Chỉ chứa primitive dùng chung cho MỌI bounded context: `DomainError` hierarchy,
`ErrorCode` enum, `TransitionTable`/`StateMachine` generic helper.

KHÔNG chứa business rule/state machine cụ thể của 1 bounded context — những thứ đó
nằm trong `apps/api/src/modules/<context>/domain/` (ví dụ:
`modules/resource-catalog/domain/resource.state-machine.ts` ở Phase 2). Enum/state
machine đã có sẵn ở đây từ Phase 1 (`organization.state-machine.ts`,
`verification-request.state-machine.ts`) là ngoại lệ lịch sử — không di chuyển vì
rủi ro không cần thiết, nhưng từ Phase 2 trở đi state machine mới đặt đúng theo quy
tắc trên.
