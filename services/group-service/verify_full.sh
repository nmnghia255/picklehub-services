#!/usr/bin/env bash
set -eo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

GROUP_SERVICE_URL="http://localhost:8003"
SPORT_CENTER_URL="http://localhost:8007"
AUTH_SERVICE_URL="http://localhost:8001"

# JWT configuration secret
JWT_SECRET="your-super-secret-access-token-key-change-this-in-production"

echo -e "${YELLOW}=== Running Picklehub Master Spec Full Flow Verification ===${NC}"

# Helper to check if a service is up
check_service() {
  local url=$1
  if curl -s --connect-timeout 2 "$url" > /dev/null; then
    return 0
  else
    return 1
  fi
}

AUTH_SERVICE_UP=false
if check_service "${AUTH_SERVICE_URL}"; then
  AUTH_SERVICE_UP=true
  echo -e "${GREEN}[INFO] auth-service is running.${NC}"
else
  echo -e "${YELLOW}[WARN] auth-service is NOT running. User-related steps will be skipped.${NC}"
fi

SPORT_CENTER_UP=false
if check_service "${SPORT_CENTER_URL}"; then
  SPORT_CENTER_UP=true
  echo -e "${GREEN}[INFO] sport-center-service is running.${NC}"
else
  echo -e "${YELLOW}[WARN] sport-center-service is NOT running. Sport-center seed will be skipped.${NC}"
fi

# Helper to assert HTTP status
assert_status() {
  local expected=$1
  local actual=$2
  local msg=$3
  if [ "$expected" -eq "$actual" ]; then
    echo -e "${GREEN}[PASS] ${msg} (Status: ${actual})${NC}"
  else
    echo -e "${RED}[FAIL] ${msg} (Expected: ${expected}, Got: ${actual})${NC}"
    exit 1
  fi
}

# Helper to sign JWT token dynamically
sign_token() {
  local user_id=$1
  local email=$2
  docker compose exec -T group-service node -e "
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: '$user_id', email: '$email', role: 'MEMBER' }, '$JWT_SECRET', { expiresIn: '1h' });
    console.log(token);
  " | tr -d '\r\n'
}

# Step 1: Re-seed databases
echo "Seeding databases..."
docker compose exec -T group-service npm run prisma:seed > /dev/null
if [ "$SPORT_CENTER_UP" = true ]; then
  docker compose exec -T sport-center-service npm run prisma:seed > /dev/null
fi
echo -e "${GREEN}Databases seeded successfully.${NC}"

# Step 2: Sign tokens
echo "Generating JWT tokens..."
OWNER_TOKEN=$(sign_token "11111111-1111-4111-8111-111111111111" "seed-user@picklehub.com")
MEMBER_TOKEN=$(sign_token "22222222-2222-4222-8222-222222222222" "seed-owner@picklehub.com")

GROUP_ID="5f2f3b7c-2c2f-4f9b-9d5e-1b4f6b9d2c11"
BOOKING_ID="b0040000-b004-4000-8000-000000010010"

# Step 3: List group members
echo -e "\n${YELLOW}--- Step 3: Fetching Group Members ---${NC}"
if [ "$AUTH_SERVICE_UP" = true ]; then
  MEMBERS_RESP=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer ${MEMBER_TOKEN}" \
    "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/members")

  MEMBERS_STATUS=$(echo "$MEMBERS_RESP" | tail -n1)
  assert_status 200 "$MEMBERS_STATUS" "Get group members"
else
  echo -e "${YELLOW}[SKIP] Skipping group members fetch since auth-service is not running.${NC}"
fi

# Step 4: Create a new play session
echo -e "\n${YELLOW}--- Step 4: Creating a Play Session (Activity) ---${NC}"
START_AT=$(docker compose exec -T group-service node -e "
  const d = new Date();
  d.setDate(d.getDate() + 2); // 2 days in the future
  console.log(d.toISOString());
" | tr -d '\r\n')
END_AT=$(docker compose exec -T group-service node -e "
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(d.getHours() + 2);
  console.log(d.toISOString());
" | tr -d '\r\n')

ACTIVITY_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Weekly Play Session\", \"description\": \"Regular slot\", \"activityType\": \"PRACTICE\", \"startAt\": \"${START_AT}\", \"endAt\": \"${END_AT}\", \"cancellationDeadlineHours\": 12}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities")

ACTIVITY_STATUS=$(echo "$ACTIVITY_RESP" | tail -n1)
ACTIVITY_BODY=$(echo "$ACTIVITY_RESP" | head -n -1)
assert_status 201 "$ACTIVITY_STATUS" "Create group activity"

ACTIVITY_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$ACTIVITY_BODY")
echo -e "${GREEN}Created Activity ID: ${ACTIVITY_ID}${NC}"

# Step 5: Member reports absence & cancels absence
echo -e "\n${YELLOW}--- Step 5: Testing Absence Reporting ---${NC}"
ABSENCE_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/absence")
ABS_STATUS=$(echo "$ABSENCE_RESP" | tail -n1)
assert_status 200 "$ABS_STATUS" "Report absence successfully"

CANCEL_ABSENCE_RESP=$(curl -s -w "\n%{http_code}" -X DELETE \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/absence")
CANCEL_ABS_STATUS=$(echo "$CANCEL_ABSENCE_RESP" | tail -n1)
assert_status 200 "$CANCEL_ABS_STATUS" "Cancel absence successfully"

# Step 6: Member requests guests & Host approves
echo -e "\n${YELLOW}--- Step 6: Requesting and Approving Guests ---${NC}"
# 1. Requesting guestCount = 0 should fail with 400
GUEST_REQ_0_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"guestCount": 0}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests")
GUEST_0_STATUS=$(echo "$GUEST_REQ_0_RESP" | tail -n1)
assert_status 400 "$GUEST_0_STATUS" "Request guests with count 0 should return 400"

# 2. Requesting valid guestCount = 2 should pass
GUEST_REQ_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"guestCount": 2}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests")
GUEST_STATUS=$(echo "$GUEST_REQ_RESP" | tail -n1)
assert_status 200 "$GUEST_STATUS" "Request guests"

MEMBER_MEMBER_ID=$(docker compose exec -T group-service node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.groupMember.findFirst({
    where: { userId: '22222222-2222-4222-8222-222222222222', groupId: '${GROUP_ID}' }
  }).then(m => console.log(m ? m.id : ''));
" | tr -d '\r\n')

# 2b. List PENDING guest requests (GET endpoint)
LIST_GUESTS_RESP=$(curl -s -w "\n%{http_code}" -X GET \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests?status=PENDING")
LIST_GUESTS_STATUS=$(echo "$LIST_GUESTS_RESP" | tail -n1)
assert_status 200 "$LIST_GUESTS_STATUS" "List PENDING guest requests"

# 3. Approve guest request (renamed to PATCH :memberId/guests/status)
APPROVE_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/${MEMBER_MEMBER_ID}/guests/status")
APP_STATUS=$(echo "$APPROVE_RESP" | tail -n1)
assert_status 200 "$APP_STATUS" "Approve guest request"

# 4. Member re-requests while APPROVED → should store as pendingGuestCount (200, not 400)
GUEST_REQ_AFTER_APP_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"guestCount": 3}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests")
GUEST_AFTER_APP_STATUS=$(echo "$GUEST_REQ_AFTER_APP_RESP" | tail -n1)
assert_status 200 "$GUEST_AFTER_APP_STATUS" "Member re-request after APPROVED stores as pendingGuestCount (200)"

# 4b. Verify GET list shows the pending draft alongside approved
LIST_AFTER_RESP=$(curl -s -w "\n%{http_code}" -X GET \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests")
LIST_AFTER_STATUS=$(echo "$LIST_AFTER_RESP" | tail -n1)
assert_status 200 "$LIST_AFTER_STATUS" "List all guest requests (should show approved + pending draft)"

# 4c. Host REJECTS the pending draft → official approved (guestCount=2) should be preserved
REJECT_DRAFT_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "REJECTED"}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/${MEMBER_MEMBER_ID}/guests/status")
REJECT_DRAFT_STATUS=$(echo "$REJECT_DRAFT_RESP" | tail -n1)
assert_status 200 "$REJECT_DRAFT_STATUS" "Host rejects pending draft; official approved guestCount stays"

# 4d. Member re-requests again (now as a new pending draft on top of existing APPROVED)
GUEST_REQ_4D_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"guestCount": 2}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests")
GUEST_4D_STATUS=$(echo "$GUEST_REQ_4D_RESP" | tail -n1)
assert_status 200 "$GUEST_4D_STATUS" "Member re-requests again after draft was rejected"

# 4e. Host APPROVES the pending draft → guestCount should be promoted to 2
APPROVE_DRAFT_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/${MEMBER_MEMBER_ID}/guests/status")
APPROVE_DRAFT_STATUS=$(echo "$APPROVE_DRAFT_RESP" | tail -n1)
assert_status 200 "$APPROVE_DRAFT_STATUS" "Host approves pending draft → promotes to official approved"

# 5. Host cancels guest request entirely (DELETE endpoint)
CANCEL_GUESTS_RESP=$(curl -s -w "\n%{http_code}" -X DELETE \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/${MEMBER_MEMBER_ID}/guests")
CANCEL_GUESTS_STATUS=$(echo "$CANCEL_GUESTS_RESP" | tail -n1)
assert_status 200 "$CANCEL_GUESTS_STATUS" "Host cancels guest request successfully"

# 6. Re-request and re-approve to allow Step 7 linked expense check to pass
GUEST_REQ_2_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"guestCount": 2}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/guests")
GUEST_2_STATUS=$(echo "$GUEST_REQ_2_RESP" | tail -n1)
assert_status 200 "$GUEST_2_STATUS" "Re-request guests"

APPROVE_2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities/${ACTIVITY_ID}/attendance/${MEMBER_MEMBER_ID}/guests/status")
APP_2_STATUS=$(echo "$APPROVE_2_RESP" | tail -n1)
assert_status 200 "$APP_2_STATUS" "Re-approve guest request"

# 6b. Verify members API returns guestCount and avatarUrl
if [ "$AUTH_SERVICE_UP" = true ]; then
  MEMBERS_WITH_ACT_RESP=$(curl -s \
    -H "Authorization: Bearer ${MEMBER_TOKEN}" \
    "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/members?activityId=${ACTIVITY_ID}")
  if [[ "$MEMBERS_WITH_ACT_RESP" == *"guestCount"* && "$MEMBERS_WITH_ACT_RESP" == *"avatarUrl"* ]]; then
    MEM_GUEST_COUNT=$(node -e "
      const data = JSON.parse(process.argv[1]);
      const mem = data.find(m => m.userId === '22222222-2222-4222-8222-222222222222');
      console.log(mem ? mem.guestCount : 'NOT_FOUND');
    " "$MEMBERS_WITH_ACT_RESP")
    if [ "$MEM_GUEST_COUNT" = "2" ]; then
      echo -e "${GREEN}[PASS] Members API returned correct guestCount (2) and avatarUrl for activity.${NC}"
    else
      echo -e "${RED}[FAIL] Expected guestCount 2, got: ${MEM_GUEST_COUNT}${NC}"
      exit 1
    fi
  else
    echo -e "${RED}[FAIL] Members API response does not contain guestCount or avatarUrl fields.${NC}"
    exit 1
  fi
fi

# 6c. Verify list activities with hasExpense=false/true before expense creation
ACT_LIST_FALSE_RESP=$(curl -s \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities?hasExpense=false&limit=100")
HAS_ACT_FALSE=$(node -e "
  const res = JSON.parse(process.argv[1]);
  const act = res.data.find(a => a.id === '${ACTIVITY_ID}');
  console.log(act ? 'FOUND' : 'NOT_FOUND');
" "$ACT_LIST_FALSE_RESP")

ACT_LIST_TRUE_RESP=$(curl -s \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities?hasExpense=true&limit=100")
HAS_ACT_TRUE=$(node -e "
  const res = JSON.parse(process.argv[1]);
  const act = res.data.find(a => a.id === '${ACTIVITY_ID}');
  console.log(act ? 'FOUND' : 'NOT_FOUND');
" "$ACT_LIST_TRUE_RESP")

if [ "$HAS_ACT_FALSE" = "FOUND" ] && [ "$HAS_ACT_TRUE" = "NOT_FOUND" ]; then
  echo -e "${GREEN}[PASS] Activity correctly filtered by hasExpense=false/true before expense creation.${NC}"
else
  echo -e "${RED}[FAIL] hasExpense filter before expense creation failed: false_filter=${HAS_ACT_FALSE}, true_filter=${HAS_ACT_TRUE}${NC}"
  exit 1
fi

# Step 7: Create a linked expense
echo -e "\n${YELLOW}--- Step 7: Creating Expense Linked to Play Session ---${NC}"
EXPENSE_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Play Session Expense\", \"totalAmount\": 150000, \"activityId\": \"${ACTIVITY_ID}\", \"allocations\": [{\"userId\": \"11111111-1111-4111-8111-111111111111\", \"requiredFee\": 50000}, {\"userId\": \"22222222-2222-4222-8222-222222222222\", \"requiredFee\": 100000, \"guestCount\": 2, \"guestFee\": 50000}]}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/expenses")
EXP_STATUS=$(echo "$EXPENSE_RESP" | tail -n1)
EXP_BODY=$(echo "$EXPENSE_RESP" | head -n -1)
assert_status 201 "$EXP_STATUS" "Create linked expense successfully"

EXPENSE_ID=$(node -e "console.log(JSON.parse(process.argv[1]).data.id)" "$EXP_BODY")
echo -e "${GREEN}Created Expense ID: ${EXPENSE_ID}${NC}"

# Step 7b: Verify get my debt returns guestCount and guestFee
if [ "$AUTH_SERVICE_UP" = true ]; then
  DEBT_RESP=$(curl -s \
    -H "Authorization: Bearer ${MEMBER_TOKEN}" \
    "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/finances/me/debt")
  if [[ "$DEBT_RESP" == *"guestCount"* && "$DEBT_RESP" == *"guestFee"* ]]; then
    GUEST_COUNT_DEBT=$(node -e "
      const res = JSON.parse(process.argv[1]);
      const pay = res.data.unpaidPayments.find(p => p.expenseTitle === 'Play Session Expense');
      console.log(pay ? pay.guestCount : 'NOT_FOUND');
    " "$DEBT_RESP")
    GUEST_FEE_DEBT=$(node -e "
      const res = JSON.parse(process.argv[1]);
      const pay = res.data.unpaidPayments.find(p => p.expenseTitle === 'Play Session Expense');
      console.log(pay ? pay.guestFee : 'NOT_FOUND');
    " "$DEBT_RESP")
    if [ "$GUEST_COUNT_DEBT" = "2" ] && [ "$GUEST_FEE_DEBT" = "50000" ]; then
      echo -e "${GREEN}[PASS] Debt API returned correct guestCount (2) and guestFee (50000).${NC}"
    else
      echo -e "${RED}[FAIL] Expected guestCount 2 and guestFee 50000, got: count=${GUEST_COUNT_DEBT}, fee=${GUEST_FEE_DEBT}${NC}"
      exit 1
    fi
  else
    echo -e "${RED}[FAIL] Debt API response does not contain guestCount or guestFee fields.${NC}"
    exit 1
  fi
fi

# Step 7c: Verify list activities with hasExpense=true/false after expense creation
ACT_LIST_FALSE_AFTER=$(curl -s \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities?hasExpense=false&limit=100")
HAS_ACT_FALSE_AFTER=$(node -e "
  const res = JSON.parse(process.argv[1]);
  const act = res.data.find(a => a.id === '${ACTIVITY_ID}');
  console.log(act ? 'FOUND' : 'NOT_FOUND');
" "$ACT_LIST_FALSE_AFTER")

ACT_LIST_TRUE_AFTER=$(curl -s \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/activities?hasExpense=true&limit=100")
HAS_ACT_TRUE_AFTER=$(node -e "
  const res = JSON.parse(process.argv[1]);
  const act = res.data.find(a => a.id === '${ACTIVITY_ID}');
  console.log(act ? 'FOUND' : 'NOT_FOUND');
" "$ACT_LIST_TRUE_AFTER")

ACT_DETAIL_RESP=$(node -e "
  const res = JSON.parse(process.argv[1]);
  const act = res.data.find(a => a.id === '${ACTIVITY_ID}');
  console.log(act ? JSON.stringify({ hasExpense: act.hasExpense, expenseId: act.expense ? act.expense.id : null }) : 'null');
" "$ACT_LIST_TRUE_AFTER")

if [ "$HAS_ACT_FALSE_AFTER" = "NOT_FOUND" ] && [ "$HAS_ACT_TRUE_AFTER" = "FOUND" ]; then
  echo -e "${GREEN}[PASS] Activity correctly filtered by hasExpense=false/true after expense creation.${NC}"
  echo -e "${GREEN}[PASS] Activity response contains: ${ACT_DETAIL_RESP}${NC}"
else
  echo -e "${RED}[FAIL] hasExpense filter after expense creation failed: false_filter=${HAS_ACT_FALSE_AFTER}, true_filter=${HAS_ACT_TRUE_AFTER}${NC}"
  exit 1
fi

# Step 8: Top up member balance (Transactions) & Host verifies to pay off debt
echo -e "\n${YELLOW}--- Step 8: Member Payments & Host verification ---${NC}"
if [ "$AUTH_SERVICE_UP" = true ]; then
  # Compute total outstanding debt for member 22222222 to ensure we cover FIFO-allocated old debts too
  TOTAL_DEBT=$(docker compose exec -T group-service node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.groupPayment.findMany({
      where: { userId: '22222222-2222-4222-8222-222222222222', expense: { groupId: '${GROUP_ID}' }, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }
    }).then(ps => {
      const total = ps.reduce((sum, p) => sum + (p.requiredFee - p.amountPaid), 0);
      console.log(total);
      prisma.\$disconnect();
    });
  " | tr -d '\r\n')
  echo -e "Total outstanding debt for member: ${TOTAL_DEBT}"

  TX_RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer ${MEMBER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"amount\": ${TOTAL_DEBT}, \"receiptUrl\": \"https://example.com/receipt.jpg\"}" \
    "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/finances/transactions")
  TX_STATUS=$(echo "$TX_RESP" | tail -n1)
  TX_BODY=$(echo "$TX_RESP" | head -n -1)
  assert_status 201 "$TX_STATUS" "Submit transaction successfully"

  TX_ID=$(node -e "console.log(JSON.parse(process.argv[1]).data.id)" "$TX_BODY")
  echo -e "${GREEN}Created Transaction ID: ${TX_ID}${NC}"

  # Host verifies to trigger cấn trừ nợ cũ
  VERIFY_TX_RESP=$(curl -s -w "\n%{http_code}" -X PATCH \
    -H "Authorization: Bearer ${OWNER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"status": "VERIFIED"}' \
    "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/finances/transactions/${TX_ID}/verify")
  VTX_STATUS=$(echo "$VERIFY_TX_RESP" | tail -n1)
  assert_status 200 "$VTX_STATUS" "Host verifies transaction"

  # Verify the specific payment for THIS expense is now PAID (query by expenseId for idempotency)
  PAYMENT_STATUS=$(docker compose exec -T group-service node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.groupPayment.findFirst({
      where: { userId: '22222222-2222-4222-8222-222222222222', expenseId: '${EXPENSE_ID}' }
    }).then(p => { console.log(p ? p.status : 'NOT_FOUND'); prisma.\$disconnect(); });
  " | tr -d '\r\n')

  if [ "$PAYMENT_STATUS" = "PAID" ]; then
    echo -e "${GREEN}[PASS] Member payment status updated to PAID via auto-allocate (FIFO).${NC}"
  else
    echo -e "${RED}[FAIL] Expected PAID payment status, got: ${PAYMENT_STATUS}${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}[SKIP] Skipping transaction verification since auth-service is not running.${NC}"
fi

# Step 9: Manage group equipment
echo -e "\n${YELLOW}--- Step 9: Creating Equipment ---${NC}"
EQUIP_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Joola Ben Johns Paddle", "description": "Good for training", "quantity": 1, "purchaseCost": 150000, "createExpense": false}' \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/equipment")
EQUIP_STATUS=$(echo "$EQUIP_RESP" | tail -n1)
assert_status 201 "$EQUIP_STATUS" "Add equipment successfully"

# Step 10: Get group finances summary
echo -e "\n${YELLOW}--- Step 10: Viewing Finance Summary ---${NC}"
SUMMARY_RESP=$(curl -s -w "\n%{http_code}" -X GET \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  "${GROUP_SERVICE_URL}/api/groups/${GROUP_ID}/finances/summary")
SUM_STATUS=$(echo "$SUMMARY_RESP" | tail -n1)
assert_status 200 "$SUM_STATUS" "Get group finance summary"

echo -e "\n${GREEN}=== ALL FULL SPEC CHECKS PASSED SUCCESSFULLY ===${NC}"
