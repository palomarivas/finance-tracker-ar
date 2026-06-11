export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  /** Movement between the user's own accounts; netted out of reports. */
  TRANSFER = 'TRANSFER',
}
