"use client";

import { ExcelImportPanel } from "@/components/import/excel-import-panel";
import { buildWorkbook } from "@/lib/xlsx/workbook";
import { CLIENT_IMPORT_SHEET, clientErrorSheets, type ClientImportRow } from "@/features/clients/import";
import { commitClientImportAction, getClientTemplateAction, previewClientImportAction } from "@/features/clients/import-actions";

/** A4 — Clientes → Importar desde Excel. */
export function ClientImportPanel() {
  return (
    <ExcelImportPanel<ClientImportRow>
      config={{
        noun: "cliente",
        nounPlural: "clientes",
        sheetName: CLIENT_IMPORT_SHEET,
        templateFileName: "plantilla-clientes.xlsx",
        errorFileName: "clientes-con-error.xlsx",
        templateHint:
          "Trae las etapas, las provincias y los municipios oficiales de la DGII en listas, las instrucciones y 3 ejemplos (una empresa, un lead y un cliente del extranjero).",
        step1: (
          <>
            Llena la hoja <strong>«Clientes»</strong> desde la fila 2, un cliente por fila, con hasta <strong>dos contactos</strong>: el
            principal y el de cobros (que recibe los recordatorios). Solo el <strong>nombre</strong> es obligatorio; la etapa vacía queda
            como <strong>Cliente</strong>.
          </>
        ),
        loadTemplate: getClientTemplateAction,
        preview: previewClientImportAction,
        commit: commitClientImportAction,
        errorWorkbook: (rows) => buildWorkbook(clientErrorSheets(rows)),
      }}
    />
  );
}
