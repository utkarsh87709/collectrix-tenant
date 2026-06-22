// System field registry for the debtor import file. The backend's
// validateDebtorFile expects these exact snake_case CSV headers and echoes each
// record back with the camelCase `key`. Used to (a) generate the downloadable
// sample CSV, (b) label columns, and (c) render the edit form for flagged rows.
//
// NOTE: `clientNumber` is accepted but reported as an "extra" header by the
// backend and is NOT part of the updateNewDebtor payload — see omitForUpdate.
export type DebtorField = {
  key: string; // camelCase key on the record object
  header: string; // snake_case CSV column header
  label: string;
  section: string;
  omitForUpdate?: boolean; // not sent to updateNewDebtor
};

export const DEBTOR_FIELDS: DebtorField[] = [
  // File references
  { key: "ourFileNo", header: "our_file_no", label: "Our File No", section: "File references" },
  { key: "clientNumber", header: "client_number", label: "Client Number", section: "File references", omitForUpdate: true },
  { key: "clientFileNo", header: "client_file_no", label: "Client File No", section: "File references" },
  { key: "oldCounselFileNo", header: "old_counsel_file_no", label: "Old Counsel File No", section: "File references" },
  { key: "oldCounselName", header: "old_counsel_name", label: "Old Counsel Name", section: "File references" },
  // Creditor
  { key: "creditorName", header: "creditor_name", label: "Creditor Name", section: "Creditor" },
  { key: "creditorNumber", header: "creditor_number", label: "Creditor Number", section: "Creditor" },
  // Debtor
  { key: "debtorName", header: "debtor_name", label: "Debtor Name", section: "Debtor" },
  { key: "address", header: "address", label: "Address", section: "Debtor" },
  { key: "city", header: "city", label: "City", section: "Debtor" },
  { key: "province", header: "province", label: "Province", section: "Debtor" },
  { key: "postalCode", header: "postal_code", label: "Postal Code", section: "Debtor" },
  { key: "homeNo", header: "home_no", label: "Home No", section: "Debtor" },
  { key: "cellNo1", header: "cell_no_1", label: "Cell No 1", section: "Debtor" },
  { key: "cellNo2", header: "cell_no_2", label: "Cell No 2", section: "Debtor" },
  { key: "email", header: "email", label: "Email", section: "Debtor" },
  { key: "dob", header: "dob", label: "Date of Birth", section: "Debtor" },
  { key: "sin", header: "sin", label: "SIN", section: "Debtor" },
  { key: "dl", header: "dl", label: "Driver's License", section: "Debtor" },
  { key: "score", header: "score", label: "Score", section: "Debtor" },
  { key: "poe", header: "poe", label: "Place of Employment", section: "Debtor" },
  { key: "poeNo", header: "poe_no", label: "POE No", section: "Debtor" },
  // Co-debtor
  { key: "coDebtorName", header: "co_debtor_name", label: "Co-Debtor Name", section: "Co-debtor" },
  { key: "coAddress", header: "co_address", label: "Co Address", section: "Co-debtor" },
  { key: "coCity", header: "co_city", label: "Co City", section: "Co-debtor" },
  { key: "coProvince", header: "co_province", label: "Co Province", section: "Co-debtor" },
  { key: "coPostalCode", header: "co_postal_code", label: "Co Postal Code", section: "Co-debtor" },
  { key: "coHomeNo", header: "co_home_no", label: "Co Home No", section: "Co-debtor" },
  { key: "coCellNo", header: "co_cell_no", label: "Co Cell No", section: "Co-debtor" },
  { key: "coEmail", header: "co_email", label: "Co Email", section: "Co-debtor" },
  { key: "coDob", header: "co_dob", label: "Co DOB", section: "Co-debtor" },
  { key: "coSin", header: "co_sin", label: "Co SIN", section: "Co-debtor" },
  { key: "coDl", header: "co_dl", label: "Co Driver's License", section: "Co-debtor" },
  { key: "coPoe", header: "co_poe", label: "Co POE", section: "Co-debtor" },
  { key: "coPoeNo", header: "co_poe_no", label: "Co POE No", section: "Co-debtor" },
  // Financial
  { key: "principal", header: "principal", label: "Principal", section: "Financial" },
  { key: "accruedInterestBeforeAssignment", header: "accrued_interest_before_assignment", label: "Accrued Interest Before Assignment", section: "Financial" },
  { key: "interestRate", header: "interest_rate", label: "Interest Rate", section: "Financial" },
  { key: "interestType", header: "interest_type", label: "Interest Type", section: "Financial" },
  { key: "compoundingFrequency", header: "compounding_frequency", label: "Compounding Frequency", section: "Financial" },
  { key: "interestStartDate", header: "interest_start_date", label: "Interest Start Date", section: "Financial" },
  { key: "currentOutstandingBalance", header: "current_outstanding_balance", label: "Current Outstanding Balance", section: "Financial" },
  { key: "currency", header: "currency", label: "Currency", section: "Financial" },
  // Payment history
  { key: "delinquencyDate", header: "delinquency_date", label: "Delinquency Date", section: "Payment history" },
  { key: "dateOfLastPayment", header: "date_of_last_payment", label: "Date of Last Payment", section: "Payment history" },
  { key: "lastPaymentAmount", header: "last_payment_amount", label: "Last Payment Amount", section: "Payment history" },
  { key: "lastPaymentMethod", header: "last_payment_method", label: "Last Payment Method", section: "Payment history" },
  { key: "lastPaymentReferenceNumber", header: "last_payment_reference_number", label: "Last Payment Reference Number", section: "Payment history" },
  { key: "totalPaidToDate", header: "total_paid_to_date", label: "Total Paid To Date", section: "Payment history" },
  // Other
  { key: "preferredLanguage", header: "preferred_language", label: "Preferred Language", section: "Other" },
  { key: "vin", header: "vin", label: "VIN", section: "Other" },
  // Court
  { key: "courtFileNo", header: "court_file_no", label: "Court File No", section: "Court" },
  { key: "courtHouse", header: "court_house", label: "Court House", section: "Court" },
  { key: "courtHouseAddress", header: "court_house_address", label: "Court House Address", section: "Court" },
  { key: "courtHouseCity", header: "court_house_city", label: "Court House City", section: "Court" },
  { key: "courtHouseProvince", header: "court_house_province", label: "Court House Province", section: "Court" },
  { key: "courtHousePostalCode", header: "court_house_postal_code", label: "Court House Postal Code", section: "Court" },
];

export const DEBTOR_SECTIONS: string[] = [...new Set(DEBTOR_FIELDS.map((f) => f.section))];

/** Build a sample CSV (header row + one illustrative row) for users to match. */
export function buildSampleCsv(): string {
  const headers = DEBTOR_FIELDS.map((f) => f.header);
  const example: Record<string, string> = {
    our_file_no: "",
    client_number: "RBC-CLT-001",
    client_file_no: "RBC-447821",
    creditor_name: "RBC",
    creditor_number: "RBC-001",
    debtor_name: "Chen, Margaret",
    address: "12 King St W",
    city: "Toronto",
    province: "ON",
    postal_code: "M5H 1A1",
    cell_no_1: "14165550101",
    email: "margaret.chen@example.com",
    dob: "12-04-1981",
    principal: "8000",
    interest_rate: "19.99",
    interest_type: "Compound",
    compounding_frequency: "Monthly",
    current_outstanding_balance: "8420.12",
    currency: "CAD",
    preferred_language: "EN",
  };
  const row = headers.map((h) => {
    const v = example[h] ?? "";
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  });
  return `${headers.join(",")}\n${row.join(",")}\n`;
}
