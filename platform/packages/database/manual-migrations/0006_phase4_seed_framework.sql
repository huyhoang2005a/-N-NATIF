-- R2M V5 — Phase 4 seed: 1 default assessment framework + criteria, theo đúng breakdown
-- Sprint 4.1 mục 1 ("seed ít nhất 1 framework mặc định qua migration riêng, không gộp
-- vào baseline"). Áp dụng sau 0005_phase4_assessment_gap_roadmap_constraints.sql (thứ
-- tự chạy = tên file, xem migrate.ts).
--
-- Nội dung rubric dưới đây (category/criterion/title/description/weight) là VÍ DỤ MINH
-- HOẠ tự soạn (TRL — Technology Readiness Level, 6 tiêu chí phổ biến trong tech
-- transfer), KHÔNG phải nghiệp vụ đã khoá trong spec — giống cách seed account ở Phase 1
-- chỉ là dev fixture. Muốn dùng framework thật, thêm migration mới (framework có
-- version, bất biến sau khi đã dùng — không sửa đè hàng đã tạo, đúng CLAUDE.md rule 6).
--
-- `assessment_framework.created_by_user_id` NOT NULL FK `user_account` — migration này
-- chạy TRƯỚC `pnpm db:seed` (xem README §3.2), nên không thể giả định đã có admin/owner
-- account nào. Tự tạo 1 system user tối thiểu (idempotent) để gán FK, không phụ thuộc
-- thứ tự seed account.

BEGIN;

INSERT INTO user_account (id, primary_email, platform_role, status)
SELECT gen_random_uuid(), 'system@r2m.local', 'PLATFORM_ADMIN', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM user_account WHERE primary_email = 'system@r2m.local');

INSERT INTO assessment_framework
  (id, code, name, version_no, description, status, created_by_user_id, activated_at)
SELECT
  gen_random_uuid(),
  'TRL_DEFAULT',
  'Technology Readiness Level (Default)',
  1,
  'Rubric minh hoạ mặc định — 6 tiêu chí đánh giá mức độ sẵn sàng công nghệ. Không phải nghiệp vụ khoá cứng, có thể thay bằng framework thật qua migration mới.',
  'ACTIVE',
  (SELECT id FROM user_account WHERE primary_email = 'system@r2m.local'),
  now()
WHERE NOT EXISTS (SELECT 1 FROM assessment_framework WHERE code = 'TRL_DEFAULT');

INSERT INTO assessment_criterion
  (id, framework_id, category_code, criterion_code, title, description, min_score,
   max_score, weight, requires_evidence, requires_citation, sort_order)
SELECT
  gen_random_uuid(), f.id, c.category_code, c.criterion_code, c.title, c.description,
  0, 10, c.weight, true, true, c.sort_order
FROM assessment_framework f
CROSS JOIN (VALUES
  ('TECH_MATURITY', 'TECHNICAL_MATURITY', 'Technical Maturity',
   'Mức độ hoàn thiện kỹ thuật của công nghệ, từ ý tưởng tới sản phẩm đã kiểm chứng thực tế.',
   1.5, 0),
  ('MARKET_READY', 'MARKET_READINESS', 'Market Readiness',
   'Mức độ sẵn sàng và nhu cầu thị trường đối với công nghệ.',
   1.2, 1),
  ('IP_PROTECTION', 'IP_PROTECTION', 'IP Protection',
   'Mức độ bảo hộ sở hữu trí tuệ (bằng sáng chế, bản quyền, bí mật kinh doanh...).',
   1.0, 2),
  ('TEAM_CAPABILITY', 'TEAM_CAPABILITY', 'Team Capability',
   'Năng lực đội ngũ phát triển và thương mại hoá công nghệ.',
   1.0, 3),
  ('REGULATORY', 'REGULATORY_COMPLIANCE', 'Regulatory Compliance',
   'Mức độ tuân thủ quy định pháp lý liên quan tới công nghệ/lĩnh vực.',
   0.8, 4),
  ('FINANCIAL', 'FINANCIAL_VIABILITY', 'Financial Viability',
   'Tính khả thi tài chính khi thương mại hoá công nghệ.',
   1.0, 5)
) AS c(category_code, criterion_code, title, description, weight, sort_order)
WHERE f.code = 'TRL_DEFAULT'
  AND NOT EXISTS (
    SELECT 1 FROM assessment_criterion existing
    WHERE existing.framework_id = f.id AND existing.criterion_code = c.criterion_code
  );

COMMIT;
