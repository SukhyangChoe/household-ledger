"use client";

import {
  useActionState,
} from "react";

import {
  closeMonth,
  reopenMonth,
  type MonthlyCloseActionState,
} from "@/app/monthly-close/actions";

type Props = {
  month: string;
  isClosed: boolean;
  disabledReason: string | null;
};

const initialState:
  MonthlyCloseActionState = {
    status: "idle",
    message: "",
  };

function Message({
  state,
}: {
  state: MonthlyCloseActionState;
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

export function MonthlyCloseManager({
  month,
  isClosed,
  disabledReason,
}: Props) {
  const [
    closeState,
    closeAction,
    closePending,
  ] = useActionState(
    closeMonth,
    initialState,
  );

  const [
    reopenState,
    reopenAction,
    reopenPending,
  ] = useActionState(
    reopenMonth,
    initialState,
  );

  if (isClosed) {
    return (
      <div className="mt-4">
        <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
          이 월은 마감되어 거래의
          금액·날짜·상태 변경과
          삭제가 잠겨 있습니다.
          이후 열린 월에서 정산을
          완료하는 것은 가능합니다.
        </div>

        <form
          action={reopenAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `${month} 월 마감을 취소할까요?\n\n마감 취소 후 해당 월 거래를 다시 수정할 수 있습니다.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input
            type="hidden"
            name="month"
            value={month}
          />

          <button
            type="submit"
            disabled={reopenPending}
            className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            {reopenPending
              ? "마감 취소 중..."
              : "월 마감 취소"}
          </button>
        </form>

        <Message
          state={reopenState}
        />
      </div>
    );
  }

  return (
    <div className="mt-4">
      {disabledReason ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          {disabledReason}
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
          마감하면 이 월의 집계
          결과를 저장하고 거래
          재무값을 잠급니다. 잘못
          마감한 경우 가장 최근
          마감 월부터 역순으로
          취소할 수 있습니다.
        </div>
      )}

      <form
        action={closeAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `${month} 월을 마감할까요?\n\n마감 후에는 마감 취소 전까지 해당 월 거래를 수정하거나 삭제할 수 없습니다.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input
          type="hidden"
          name="month"
          value={month}
        />

        <button
          type="submit"
          disabled={
            closePending ||
            Boolean(
              disabledReason,
            )
          }
          className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {closePending
            ? "월 마감 중..."
            : "이 월 마감"}
        </button>
      </form>

      <Message state={closeState} />
    </div>
  );
}
