"use client";

import { ExcelImportPanel } from "@/components/import/excel-import-panel";
import { buildWorkbook } from "@/lib/xlsx/workbook";
import { SUPPLIER_IMPORT_SHEET, supplierErrorSheets, supplierTemplateSheets, type SupplierImportRow } from "@/features/suppliers/import";
import {
  commitSupplierImportAction,
  getSupplierTemplateDataAction,
  previewSupplierImportAction,
} from "@/features/suppliers/import-actions";

/** A3 — Proveedores → Importar desde Excel. */
export function SupplierImportPanel() {
  return (
    <ExcelImportPanel<SupplierImportRow>
      config={{
        noun: "proveedor",
        nounPlural: "proveedores",
        sheetName: SUPPLIER_IMPORT_SHEET,
        templateFileName: "plantilla-proveedores.xlsx",
        errorFileName: "proveedores-con-error.xlsx",
        templateHint:
          "Trae tus categorías, tipos de servicio y bancos actuales en listas desplegables, las instrucciones y ejemplos. Descárgala de nuevo si cambias los catálogos.",
        step1: (
          <>
            Llena la hoja <strong>«Proveedores»</strong> desde la fila 2, un proveedor por fila. Solo el <strong>nombre</strong> es
            obligatorio, pero con el tipo de proveedor, la condición fiscal y el tipo de servicio sus gastos se clasifican solos.
          </>
        ),
        loadTemplate: async () => {
          const res = await getSupplierTemplateDataAction();
          return res.error !== null ? res : { error: null, bytes: buildWorkbook(supplierTemplateSheets(res.catalogs)) };
        },
        preview: previewSupplierImportAction,
        commit: commitSupplierImportAction,
        errorWorkbook: (rows) => buildWorkbook(supplierErrorSheets(rows)),
      }}
    />
  );
}
