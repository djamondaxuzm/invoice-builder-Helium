// @vitest-environment node
import { Document, Page, Text, pdf } from '@react-pdf/renderer';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';
import { expect, it } from 'vitest';
import { LogoInfo } from '../pages/invoices/Preview/LogoInfo';
import { SizeType } from '../shared/enums/sizeType';

it('keeps wide and tall business logos proportional at every invoice logo size', async () => {
  const samples = await Promise.all(
    ['wide-logo', 'tall-logo'].map(async name => ({
      name,
      data: new Uint8Array(await readFile(resolve('src/renderer/__tests__/fixtures', name + '.png')))
    }))
  );
  const cases = samples.flatMap(sample =>
    [SizeType.small, SizeType.medium, SizeType.large].map(size => ({ ...sample, size }))
  );
  const blob = await pdf(
    <Document>
      {cases.map(({ name, data, size }) => (
        <Page key={name + size} size="A6" style={{ padding: 24 }}>
          <Text style={{ fontSize: 12, marginBottom: 20 }}>
            {name} / {size}
          </Text>
          <LogoInfo
            logoUrl={'data:image/png;base64,' + Buffer.from(data).toString('base64')}
            invoiceForm={{
              invoiceBusinessSnapshot: { businessLogo: data, businessName: 'Logo test', businessShortName: 'LT' },
              invoiceCustomization: {
                logoSize: size,
                fieldSortOrders: { no: 0, item: 1, unit: 2, quantity: 3, unitCost: 4, total: 5 }
              }
            }}
          />
        </Page>
      ))}
    </Document>
  ).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const doc = await PDFDocument.load(bytes);
  for (let i = 0; i < cases.length; i++) {
    const contents = doc.getPage(i).node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => doc.context.lookup(ref)) : [contents];
    const ops = streams.map(stream => inflateSync((stream as PDFRawStream).contents).toString()).join('\n');
    const match = ops.match(/([\d.]+) 0 0 (-?[\d.]+) [\d.-]+ [\d.-]+ cm\s*\/I\w+ Do/);
    expect(match, ops).not.toBeNull();
    const ratio = Math.abs(Number(match![1]) / Number(match![2]));
    expect(ratio).toBeCloseTo(cases[i].name === 'wide-logo' ? 4 : 0.25, 5);
  }
  if (process.env.LOGO_PDF_OUTPUT) {
    await mkdir(process.env.LOGO_PDF_OUTPUT, { recursive: true });
    await writeFile(resolve(process.env.LOGO_PDF_OUTPUT, 'logo-proportions.pdf'), bytes);
  }
});
