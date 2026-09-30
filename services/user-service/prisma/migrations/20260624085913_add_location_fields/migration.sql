-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "district" VARCHAR(100),
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- Backfill city and district using regex keyword matching from address
UPDATE "users"
SET
  "city" = CASE
    WHEN "address" ILIKE '%hà nội%' OR "address" ILIKE '%ha noi%' THEN 'Hà Nội'
    WHEN "address" ILIKE '%hồ chí minh%' OR "address" ILIKE '%ho chi minh%' OR "address" ILIKE '%hcm%' OR "address" ILIKE '%sài gòn%' OR "address" ILIKE '%sai gon%' THEN 'Hồ Chí Minh'
    WHEN "address" ILIKE '%đà nẵng%' OR "address" ILIKE '%da nang%' THEN 'Đà Nẵng'
    WHEN "address" ILIKE '%bình dương%' OR "address" ILIKE '%binh duong%' THEN 'Bình Dương'
    WHEN "address" ILIKE '%đồng nai%' OR "address" ILIKE '%dong nai%' THEN 'Đồng Nai'
    ELSE "city"
  END,
  "district" = CASE
    WHEN "address" ILIKE '%quận 1%' OR "address" ILIKE '%district 1%' OR "address" ILIKE '%q1%' OR "address" ILIKE '%q.1%' THEN 'Quận 1'
    WHEN "address" ILIKE '%quận 2%' OR "address" ILIKE '%district 2%' OR "address" ILIKE '%q2%' OR "address" ILIKE '%q.2%' THEN 'Quận 2'
    WHEN "address" ILIKE '%quận 3%' OR "address" ILIKE '%district 3%' OR "address" ILIKE '%q3%' OR "address" ILIKE '%q.3%' THEN 'Quận 3'
    WHEN "address" ILIKE '%quận 7%' OR "address" ILIKE '%district 7%' OR "address" ILIKE '%q7%' OR "address" ILIKE '%q.7%' THEN 'Quận 7'
    WHEN "address" ILIKE '%thủ đức%' OR "address" ILIKE '%thu duc%' THEN 'Thủ Đức'
    WHEN "address" ILIKE '%bình thạnh%' OR "address" ILIKE '%binh thanh%' THEN 'Bình Thạnh'
    WHEN "address" ILIKE '%phú nhuận%' OR "address" ILIKE '%phu nhuan%' THEN 'Phú Nhuận'
    WHEN "address" ILIKE '%tân bình%' OR "address" ILIKE '%tan binh%' THEN 'Tân Bình'
    WHEN "address" ILIKE '%gò vấp%' OR "address" ILIKE '%go vap%' THEN 'Gò Vấp'
    WHEN "address" ILIKE '%hoàn kiếm%' OR "address" ILIKE '%hoan kiem%' THEN 'Hoàn Kiếm'
    WHEN "address" ILIKE '%ba đình%' OR "address" ILIKE '%ba dinh%' THEN 'Ba Đình'
    WHEN "address" ILIKE '%đống đa%' OR "address" ILIKE '%dong da%' THEN 'Đống Đa'
    WHEN "address" ILIKE '%hai bà trưng%' OR "address" ILIKE '%hai ba trung%' THEN 'Hai Bà Trưng'
    WHEN "address" ILIKE '%cầu giấy%' OR "address" ILIKE '%cau giay%' THEN 'Cầu Giấy'
    WHEN "address" ILIKE '%tây hồ%' OR "address" ILIKE '%tay ho%' THEN 'Tây Hồ'
    WHEN "address" ILIKE '%thanh xuân%' OR "address" ILIKE '%thanh xuan%' THEN 'Thanh Xuân'
    ELSE "district"
  END
WHERE "address" IS NOT NULL AND ("city" IS NULL OR "district" IS NULL);

