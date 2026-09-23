import { buildReportModel, type ReportInput } from './reportModel';
import { loadReportFonts } from './fonts';
import { renderReportPdf } from './pdfReport';

/** Builds the report in the chosen language, renders the PDF and triggers a download. */
export async function downloadReportPdf(input: ReportInput): Promise<void> {
  const model = buildReportModel(input);
  const bytes = await renderReportPdf(model, await loadReportFonts());
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const months = model.period.months;
  const range = months.length === 1 ? months[0] : `${months[0]}_${months[months.length - 1]}`;
  a.href = url;
  a.download = `diwaniya-account-report_${range}_${input.language}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
