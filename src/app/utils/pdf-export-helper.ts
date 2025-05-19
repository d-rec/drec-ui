import { TDocumentDefinitions } from 'pdfmake/interfaces';

export async function generatePDFBlob(
  headerName: string,
  headers: string[],
  data: any[][],
  styles?: any,
): Promise<Blob> {
  // Dynamically import pdfMake and fonts
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');

  (pdfMakeModule.default as any).vfs = pdfFontsModule.default.vfs;
  const pdfMake = pdfMakeModule.default;

  // Insert header row at the start of the data array
  const tableBody = [headers, ...data];

  const documentDefinition: TDocumentDefinitions = {
    content: [
      { text: headerName, style: 'header' },
      {
        style: 'tableExample',
        table: {
          headerRows: 1,
          widths: Array(headers.length).fill('*'),
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f2f2f2' : null),
        },
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
        color: '#f2be1a',
      },
      tableExample: {
        margin: [0, 5, 0, 15],
      },
      ...styles,
    },
    defaultStyle: {
      fontSize: 10,
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(documentDefinition);

      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob);
      });
    } catch (err) {
      reject(err);
    }
  });
}
