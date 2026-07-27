export const demoTransactions = [
  { id: "t1", date: "07.10", name: "부모급여", type: "수입", amount: 1_000_000, purpose: "생활비 100%", nature: "-", account: "아내 생활비 계좌", status: "확정" },
  { id: "t2", date: "07.20", name: "관리비", type: "지출", amount: 280_000, purpose: "생활비", nature: "고정", account: "아내 생활비 계좌", status: "확정" },
  { id: "t3", date: "07.25", name: "남편 카드 식비", type: "지출", amount: 500_000, purpose: "생활비", nature: "변동", account: "남편 결제 계좌", status: "확정" },
  { id: "t4", date: "07.25", name: "챗GPT", type: "지출", amount: 30_000, purpose: "투자", nature: "고정", account: "남편 결제 계좌", status: "확정" },
  { id: "t5", date: "07.25", name: "투자용 노트북 4/12", type: "지출", amount: 150_000, purpose: "투자", nature: "고정", account: "남편 결제 계좌", status: "예정" },
];

export const settlementItems = [
  { id: "s1", group: "받을 생활비", title: "남편 월급", direction: "남편 계좌 → 생활비 계좌", amount: 1_410_000 },
  { id: "s2", group: "보낼 정산금", title: "남편 카드 식비", direction: "생활비 계좌 → 남편 계좌", amount: 500_000 },
  { id: "s3", group: "보낼 정산금", title: "남편 보험료", direction: "생활비 계좌 → 남편 계좌", amount: 200_000 },
];

export const recurringRules = [
  { name: "남편 월급", period: "2026.01 ~ 종료 없음", day: "매월 25일", amount: 5_000_000, link: "남편 계좌", progress: "-" },
  { name: "부모급여", period: "2026.01 ~ 2027.03", day: "매월 10일", amount: 1_000_000, link: "생활비 계좌", progress: "-" },
  { name: "챗GPT", period: "2026.01 ~ 종료 없음", day: "카드 결제일", amount: 30_000, link: "남편 카드", progress: "-" },
  { name: "투자용 노트북", period: "2026.04 ~ 2027.03", day: "카드 결제일", amount: 150_000, link: "남편 카드", progress: "4/12" },
];

export function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
