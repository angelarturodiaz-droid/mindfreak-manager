import { describe, expect, it } from "vitest";
import {
  parseBankDetails,
  suggestedAccountIds,
  toBankDetails,
  type BankDetailOption,
} from "@/features/banks/bank-details";

const promerica: BankDetailOption = {
  id: "a1",
  name: "Promerica USD",
  bank_name: "Banco Promerica",
  account_number_masked: "51181787815",
  account_kind: "SAVINGS",
  currency: "USD",
  holder_name: null,
};
const popular: BankDetailOption = {
  id: "a2",
  name: "Popular",
  bank_name: "Banco Popular Dominicano",
  account_number_masked: "48848484",
  account_kind: null,
  currency: "DOP",
  holder_name: "Juan Pérez",
};
const company = { name: "Mindfreak", legal_name: "Mindfreak Events SRL", tax_id: "131-00000-1" };

describe("datos bancarios para el pago", () => {
  it("sugiere solo las cuentas en la moneda del documento", () => {
    expect(suggestedAccountIds([promerica, popular], "USD")).toEqual(["a1"]);
    expect(suggestedAccountIds([promerica, popular], "DOP")).toEqual(["a2"]);
    expect(suggestedAccountIds([promerica, popular], "EUR")).toEqual([]);
  });

  it("titular y RNC de la empresa por defecto; tipo en español", () => {
    const [d] = toBankDetails([promerica], company);
    expect(d).toMatchObject({
      bank_account_id: "a1",
      bank_name: "Banco Promerica",
      number: "51181787815",
      kind_label: "Ahorros",
      currency: "USD",
      holder: "Mindfreak Events SRL",
      tax_id: "131-00000-1",
    });
  });

  it("titular propio de la cuenta: sin RNC de la empresa; sin tipo si no tiene", () => {
    const [d] = toBankDetails([popular], company);
    expect(d.holder).toBe("Juan Pérez");
    expect(d.tax_id).toBeNull();
    expect(d.kind_label).toBeNull();
  });

  it("lee el jsonb de forma segura", () => {
    expect(parseBankDetails(null)).toEqual([]);
    expect(parseBankDetails({})).toEqual([]);
    expect(parseBankDetails([{ bank_account_id: "x" }, null, 3])).toHaveLength(1);
  });
});
