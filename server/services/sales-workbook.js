import ExcelJS from 'exceljs';

export const normalizeName = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const north = ['FCT','Kaduna','Kano','Kwara','Niger','Nasarawa','Plateau','Benue','Kogi','Bauchi','Gombe','Adamawa','Taraba','Borno','Yobe','Jigawa','Katsina','Sokoto','Kebbi','Zamfara'];
const south = ['Oyo','Ogun','Osun','Ondo','Ekiti','Imo','Abia','Anambra','Enugu','Ebonyi','Delta','Edo','Rivers','Bayelsa','Cross River','Akwa Ibom'];
export function stateIdentity(value) {
  const key = normalizeName(value).replace(/state$/, '');
  const state = key === 'abuja' ? 'FCT' : ['Lagos',...north,...south].find(s => normalizeName(s) === key);
  return state ? {state, region:state === 'Lagos' ? 'LAG' : north.includes(state) ? 'NOR' : 'SSE'} : {state:null,region:null};
}
export function parseMoney(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`Invalid monetary value: ${text}`);
  const [whole, fraction = ''] = text.split('.');
  const kobo = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(kobo) || kobo <= 0) throw new Error('Premium must be a positive safe integer in kobo');
  return kobo;
}
export async function parseSalesWorkbook(bytes) {
  const book = await new ExcelJS.Workbook().xlsx.load(bytes);
  const rows = [];
  for (const sheet of book.worksheets) {
    const headers = sheet.getRow(1).values;
    for (const name of ['Policy ID','Premium','Payment Amount','Sales Date','Payment Status','MBE Name','Store Name','State','Device Name','Variant/Plan']) {
      if (headers.indexOf(name) < 1) throw new Error(`Missing ${name} in ${sheet.name}`);
    }
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const get = name => headers.indexOf(name)>0 ? row.getCell(headers.indexOf(name)).text.trim() : '';
      if (!get('Premium')) {
        if (get('Policy ID')) throw new Error(`Policy without premium: ${sheet.name}:${number}`);
        return;
      }
      const valueKobo = parseMoney(get('Premium'));
      if (parseMoney(get('Payment Amount')) !== valueKobo) throw new Error(`Payment mismatch: ${sheet.name}:${number}`);
      const timestamp = get('Sales Date');
      if (!/^2026-09-\d{2}T.*Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString().slice(0,10) !== timestamp.slice(0,10)) throw new Error(`Invalid date: ${sheet.name}:${number}`);
      const id = get('Policy ID');
      if (!id) throw new Error(`Missing policy ID: ${sheet.name}:${number}`);
      rows.push({sheet:sheet.name,sourceRow:number,transactionId:id,businessDate:timestamp.slice(0,10),sourceTimestamp:timestamp,valueKobo,paymentStatus:get('Payment Status').toUpperCase(),sourceAgentName:get('MBE Name') || 'Unattributed',sourceStoreName:get('Store Name'),sourceState:get('State'),sourceCluster:get('Cluster'),device:get('Device Name'),rawPlan:get('Variant/Plan'),...stateIdentity(get('State'))});
    });
  }
  if (!rows.length) throw new Error('Workbook has no sales rows');
  return rows;
}
