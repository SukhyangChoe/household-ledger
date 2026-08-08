"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createCategory,
  deleteCategory,
  toggleCategoryActive,
  updateCategory,
  type CategoryActionState,
} from "@/app/settings/categories/actions";
import { Badge } from "@/components/ui";
import type { Database } from "@/types/database.types";

type Account =
  Database["public"]["Tables"]["accounts"]["Row"];

type Category =
  Database["public"]["Tables"]["categories"]["Row"];

type RateRule =
  Database["public"]["Tables"]["rate_rules"]["Row"];

type TransactionType = "income" | "expense";

type Props = {
  accounts: Account[];
  categories: Category[];
  rateRules: RateRule[];
};

const initialState: CategoryActionState = {
  status: "idle",
  message: "",
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const fundPurposeLabels = {
  living: "생활비",
  investment: "투자",
} as const;

const expenseNatureLabels = {
  fixed: "고정",
  variable: "변동",
  irregular: "비정기",
} as const;

function formatRate(rateBps: number) {
  return `${(
    rateBps / 100
  ).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })}%`;
}

function ActionMessage({
  state,
}: {
  state: CategoryActionState;
}) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "mt-3 text-sm text-emerald-700"
          : "mt-3 text-sm text-red-600"
      }
    >
      {state.message}
    </p>
  );
}

function CreateCategoryForm({
  accounts,
  rateRules,
}: {
  accounts: Account[];
  rateRules: RateRule[];
}) {
  const detailsRef =
    useRef<HTMLDetailsElement>(null);
  const formRef =
    useRef<HTMLFormElement>(null);

  const [
    transactionType,
    setTransactionType,
  ] = useState<TransactionType>(
    "income",
  );

  const activeAccounts =
    accounts.filter(
      (account) => account.is_active,
    );

  const currentRateRules =
    rateRules.filter(
      (rateRule) =>
        rateRule.is_active &&
        rateRule.valid_to === null,
    );

  const [
    state,
    formAction,
    isPending,
  ] = useActionState(
    createCategory,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      detailsRef.current?.removeAttribute(
        "open",
      );
    }
  }, [state]);

  const incomeUnavailable =
    transactionType === "income" &&
    currentRateRules.length === 0;

  return (
    <>
      <details
        ref={detailsRef}
        className="mt-4 rounded-2xl border border-[var(--border)] bg-gray-50"
      >
        <summary className="cursor-pointer px-4 py-4 font-semibold">
          새 카테고리 등록
        </summary>

        <form
          ref={formRef}
          action={formAction}
          onReset={() => {
            setTransactionType(
              "income",
            );
          }}
          className="border-t border-[var(--border)] p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              유형
              <select
                name="transactionType"
                value={transactionType}
                onChange={(event) => {
                  setTransactionType(
                    event.target
                      .value as TransactionType,
                  );
                }}
                className={inputClassName}
              >
                <option value="income">
                  수입
                </option>
                <option value="expense">
                  지출
                </option>
              </select>
            </label>

            <label className="text-sm font-medium">
              카테고리명
              <input
                name="name"
                type="text"
                maxLength={50}
                placeholder={
                  transactionType ===
                  "income"
                    ? "예: 남편 월급"
                    : "예: 식비"
                }
                required
                className={
                  inputClassName
                }
              />
            </label>
          </div>

          {transactionType ===
          "income" ? (
            <>
              {currentRateRules.length ===
              0 ? (
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  먼저 현재 적용 중인
                  생활비 반영률을
                  등록해주세요.
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  생활비 반영률
                  <select
                    name="rateRuleId"
                    required
                    disabled={
                      incomeUnavailable
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      반영률 선택
                    </option>

                    {currentRateRules.map(
                      (rateRule) => (
                        <option
                          key={
                            rateRule.id
                          }
                          value={
                            rateRule.id
                          }
                        >
                          {
                            rateRule.name
                          }{" "}
                          ·{" "}
                          {formatRate(
                            rateRule.rate_bps,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  기본 수령 계좌
                  <select
                    name="defaultAccountId"
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      선택 안 함
                    </option>

                    {activeAccounts.map(
                      (account) => (
                        <option
                          key={
                            account.id
                          }
                          value={
                            account.id
                          }
                        >
                          {
                            account.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  name="isAssetIncome"
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-700"
                />
                자산소득으로 집계
              </label>
            </>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                선택 시 자금 목적
                <select
                  name="fundPurpose"
                  defaultValue="living"
                  className={
                    inputClassName
                  }
                >
                  <option value="living">
                    생활비
                  </option>
                  <option value="investment">
                    투자
                  </option>
                </select>
              </label>

              <label className="text-sm font-medium">
                선택 시 지출 성격
                <select
                  name="expenseNature"
                  defaultValue="variable"
                  className={
                    inputClassName
                  }
                >
                  <option value="fixed">
                    고정
                  </option>
                  <option value="variable">
                    변동
                  </option>
                  <option value="irregular">
                    비정기
                  </option>
                </select>
              </label>
            </div>
          )}

          <p className="mt-3 text-xs leading-5 text-gray-500">
            카테고리의 기본값은 거래
            입력 시 자동 선택되지만,
            실제 거래에서는 필요에
            따라 변경할 수 있습니다.
          </p>

          <button
            type="submit"
            disabled={
              isPending ||
              incomeUnavailable
            }
            className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "등록 중..."
              : "카테고리 등록"}
          </button>
        </form>
      </details>

      <ActionMessage state={state} />
    </>
  );
}

function CategoryRow({
  accountMap,
  category,
  rateRuleMap,
  accounts,
  rateRules,
}: {
  accountMap: Map<
    string,
    Account
  >;
  category: Category;
  rateRuleMap: Map<
    string,
    RateRule
  >;
  accounts: Account[];
  rateRules: RateRule[];
}) {
  const editDetailsRef =
    useRef<HTMLDetailsElement>(null);

  const linkedRateRule =
    category.rate_rule_id
      ? rateRuleMap.get(
          category.rate_rule_id,
        )
      : null;

  const linkedAccount =
    category.default_account_id
      ? accountMap.get(
          category.default_account_id,
        )
      : null;

  const selectableRateRules =
    rateRules.filter(
      (rateRule) =>
        (rateRule.is_active &&
          rateRule.valid_to ===
            null) ||
        rateRule.id ===
          category.rate_rule_id,
    );

  const selectableAccounts =
    accounts.filter(
      (account) =>
        account.is_active ||
        account.id ===
          category.default_account_id,
    );

  const [
    updateState,
    updateAction,
    updatePending,
  ] = useActionState(
    updateCategory,
    initialState,
  );

  const [
    activeState,
    activeAction,
    activePending,
  ] = useActionState(
    toggleCategoryActive,
    initialState,
  );

  const [
    deleteState,
    deleteAction,
    deletePending,
  ] = useActionState(
    deleteCategory,
    initialState,
  );

  useEffect(() => {
    if (
      updateState.status === "success"
    ) {
      editDetailsRef.current?.removeAttribute(
        "open",
      );
    }
  }, [updateState]);

  return (
    <div className="py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-semibold ${
                category.is_active
                  ? ""
                  : "text-gray-400 line-through"
              }`}
            >
              {category.name}
            </p>

            {category.transaction_type ===
            "income" ? (
              category.is_asset_income ? (
                <Badge tone="good">
                  자산소득
                </Badge>
              ) : (
                <Badge>
                  일반 수입
                </Badge>
              )
            ) : (
              <>
                <Badge>
                  {
                    fundPurposeLabels[
                      category.suggested_fund_purpose ??
                        "living"
                    ]
                  }
                </Badge>

                <Badge>
                  {
                    expenseNatureLabels[
                      category.suggested_expense_nature ??
                        "variable"
                    ]
                  }
                </Badge>
              </>
            )}

            {!category.is_active ? (
              <Badge tone="warn">
                비활성
              </Badge>
            ) : null}
          </div>

          {category.transaction_type ===
          "income" ? (
            <>
              <p className="mt-2 text-xs text-gray-500">
                반영률:{" "}
                {linkedRateRule
                  ? `${
                      linkedRateRule.name
                    } · ${formatRate(
                      linkedRateRule.rate_bps,
                    )}`
                  : "연결 없음"}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                기본 수령 계좌:{" "}
                {linkedAccount?.name ??
                  "선택 안 함"}
                {linkedAccount &&
                !linkedAccount.is_active
                  ? " · 비활성 계좌"
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              거래 선택 시 기본값으로
              자동 입력됩니다.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <form
            action={activeAction}
          >
            <input
              type="hidden"
              name="categoryId"
              value={category.id}
            />

            <input
              type="hidden"
              name="nextActive"
              value={String(
                !category.is_active,
              )}
            />

            <button
              type="submit"
              disabled={activePending}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {activePending
                ? "처리 중..."
                : category.is_active
                  ? "비활성화"
                  : "활성화"}
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              const confirmed =
                window.confirm(
                  `"${category.name}" 카테고리를 완전히 삭제할까요?\n\n거래나 정기항목에 사용된 카테고리라면 삭제되지 않습니다.`,
                );

              if (!confirmed) {
                event.preventDefault();
              }
            }}
          >
            <input
              type="hidden"
              name="categoryId"
              value={category.id}
            />

            <button
              type="submit"
              disabled={deletePending}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deletePending
                ? "삭제 중..."
                : "삭제"}
            </button>
          </form>
        </div>
      </div>

      <ActionMessage
        state={activeState}
      />
      <ActionMessage
        state={deleteState}
      />

      <details
        ref={editDetailsRef}
        className="mt-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          카테고리 정보 수정
        </summary>

        <form
          action={updateAction}
          className="mt-3 rounded-xl bg-gray-50 p-4"
        >
          <input
            type="hidden"
            name="categoryId"
            value={category.id}
          />

          <label className="block text-sm font-medium">
            카테고리명
            <input
              name="name"
              type="text"
              defaultValue={
                category.name
              }
              maxLength={50}
              required
              className={
                inputClassName
              }
            />
          </label>

          {category.transaction_type ===
          "income" ? (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  생활비 반영률
                  <select
                    name="rateRuleId"
                    defaultValue={
                      category.rate_rule_id ??
                      ""
                    }
                    required
                    className={
                      inputClassName
                    }
                  >
                    {selectableRateRules.map(
                      (rateRule) => (
                        <option
                          key={
                            rateRule.id
                          }
                          value={
                            rateRule.id
                          }
                        >
                          {
                            rateRule.name
                          }{" "}
                          ·{" "}
                          {formatRate(
                            rateRule.rate_bps,
                          )}
                          {!rateRule.is_active ||
                          rateRule.valid_to
                            ? " (과거 버전)"
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  기본 수령 계좌
                  <select
                    name="defaultAccountId"
                    defaultValue={
                      category.default_account_id ??
                      ""
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      선택 안 함
                    </option>

                    {selectableAccounts.map(
                      (account) => (
                        <option
                          key={
                            account.id
                          }
                          value={
                            account.id
                          }
                        >
                          {
                            account.name
                          }
                          {!account.is_active
                            ? " (비활성)"
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  name="isAssetIncome"
                  type="checkbox"
                  defaultChecked={
                    category.is_asset_income ??
                    false
                  }
                  className="h-4 w-4 accent-emerald-700"
                />
                자산소득으로 집계
              </label>
            </>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                선택 시 자금 목적
                <select
                  name="fundPurpose"
                  defaultValue={
                    category.suggested_fund_purpose ??
                    "living"
                  }
                  className={
                    inputClassName
                  }
                >
                  <option value="living">
                    생활비
                  </option>
                  <option value="investment">
                    투자
                  </option>
                </select>
              </label>

              <label className="text-sm font-medium">
                선택 시 지출 성격
                <select
                  name="expenseNature"
                  defaultValue={
                    category.suggested_expense_nature ??
                    "variable"
                  }
                  className={
                    inputClassName
                  }
                >
                  <option value="fixed">
                    고정
                  </option>
                  <option value="variable">
                    변동
                  </option>
                  <option value="irregular">
                    비정기
                  </option>
                </select>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={updatePending}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updatePending
              ? "저장 중..."
              : "수정 저장"}
          </button>
        </form>
      </details>

      <ActionMessage
        state={updateState}
      />
    </div>
  );
}

function CategorySection({
  title,
  emptyMessage,
  categories,
  accounts,
  rateRules,
}: {
  title: string;
  emptyMessage: string;
  categories: Category[];
  accounts: Account[];
  rateRules: RateRule[];
}) {
  const accountMap = new Map(
    accounts.map((account) => [
      account.id,
      account,
    ]),
  );

  const rateRuleMap = new Map(
    rateRules.map((rateRule) => [
      rateRule.id,
      rateRule,
    ]),
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] p-4">
      <h3 className="font-semibold">
        {title}
      </h3>

      <div className="mt-2 divide-y divide-[var(--border)]">
        {categories.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {emptyMessage}
          </p>
        ) : (
          categories.map(
            (category) => (
              <CategoryRow
                key={category.id}
                category={category}
                accounts={accounts}
                rateRules={
                  rateRules
                }
                accountMap={
                  accountMap
                }
                rateRuleMap={
                  rateRuleMap
                }
              />
            ),
          )
        )}
      </div>
    </section>
  );
}

export function CategoryManager({
  accounts,
  categories,
  rateRules,
}: Props) {
  const incomeCategories =
    categories.filter(
      (category) =>
        category.transaction_type ===
        "income",
    );

  const expenseCategories =
    categories.filter(
      (category) =>
        category.transaction_type ===
        "expense",
    );

  return (
    <>
      <CreateCategoryForm
        accounts={accounts}
        rateRules={rateRules}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <CategorySection
          title="수입 카테고리"
          emptyMessage="등록된 수입 카테고리가 없습니다."
          categories={
            incomeCategories
          }
          accounts={accounts}
          rateRules={rateRules}
        />

        <CategorySection
          title="지출 카테고리"
          emptyMessage="등록된 지출 카테고리가 없습니다."
          categories={
            expenseCategories
          }
          accounts={accounts}
          rateRules={rateRules}
        />
      </div>
    </>
  );
}
