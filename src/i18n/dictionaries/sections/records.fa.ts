import type { Dictionary } from "../en";

type Records = Pick<Dictionary, "history">;

export const recordsFa: Records = {
  history: {
    sourceRecords: "اسناد ({count})",
    limited: "{shown} سند اول از {total} سند نمایش داده می‌شود.",
    someFailed: "{count} سند بارگیری نشد.",
    open: "سابقه",
    title: "سابقه سند مالی",
    provenance: "نسخه فعلی و منبع",
    openImport: "مشاهده درون‌ریزی",
    enteredManually: "درون‌ریزی نشده (ثبت دستی یا پذیرفته از سند)",
    versions: "نسخه‌ها ({count})",
    version: "نسخه {n}",
    by: "{user} · {when}",
    created: "اولین ثبت. نسخه‌های بعدی تغییرات را نشان می‌دهند.",
    changesCaption: "فیلدهای تغییرکرده در نسخه {n}",
    fields: {
      recordType: "نوع",
      fund: "صندوق",
      status: "وضعیت",
      direction: "جهت",
      amount: "مبلغ",
      currency: "ارز",
      transactionDate: "تاریخ تراکنش",
      dueDate: "سررسید",
      financialPeriodId: "دوره",
      lotId: "{Lot}",
      supplierId: "تأمین‌کننده",
      categoryId: "دسته",
      externalReference: "مرجع",
      description: "شرح",
      sourceDocumentId: "سند منبع",
      importBatchId: "درون‌ریزی",
    },
  },
};
