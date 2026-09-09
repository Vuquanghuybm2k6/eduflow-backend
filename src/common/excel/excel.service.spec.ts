import { Test, TestingModule } from '@nestjs/testing';
import ExcelJS from 'exceljs';

import { ExcelService } from './excel.service';
import { ExcelRow } from './excel.types';

describe('ExcelService', () => {
  let service: ExcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelService],
    }).compile();

    service = module.get<ExcelService>(ExcelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkbook', () => {
    it('should create a workbook', () => {
      const workbook = service.createWorkbook();

      expect(workbook).toBeInstanceOf(ExcelJS.Workbook);
    });
  });

  describe('addWorksheet', () => {
    it('should add a worksheet with the given name', () => {
      const workbook = service.createWorkbook();

      const worksheet = service.addWorksheet(workbook, 'Students');

      expect(worksheet.name).toBe('Students');
      expect(workbook.worksheets).toHaveLength(1);
    });
  });

  describe('readWorkbook', () => {
    it('should load a workbook from a buffer', async () => {
      const workbook = service.createWorkbook();
      service.addWorksheet(workbook, 'Students');
      const buffer = await service.writeWorkbook(workbook);

      const loaded = await service.readWorkbook(buffer);

      expect(loaded).toBeInstanceOf(ExcelJS.Workbook);
      expect(loaded.worksheets).toHaveLength(1);
      expect(loaded.worksheets[0].name).toBe('Students');
    });
  });

  describe('getWorksheet', () => {
    it('should return the first worksheet when no sheet name is given', () => {
      const workbook = service.createWorkbook();
      service.addWorksheet(workbook, 'First');
      service.addWorksheet(workbook, 'Second');

      const worksheet = service.getWorksheet(workbook);

      expect(worksheet.name).toBe('First');
    });

    it('should return the worksheet matching the given sheet name', () => {
      const workbook = service.createWorkbook();
      service.addWorksheet(workbook, 'First');
      service.addWorksheet(workbook, 'Second');

      const worksheet = service.getWorksheet(workbook, 'Second');

      expect(worksheet.name).toBe('Second');
    });

    it('should throw when the named worksheet does not exist', () => {
      const workbook = service.createWorkbook();
      service.addWorksheet(workbook, 'First');

      expect(() => service.getWorksheet(workbook, 'Missing')).toThrow(
        'Worksheet "Missing" not found',
      );
    });

    it('should throw when the workbook has no worksheets', () => {
      const workbook = service.createWorkbook();

      expect(() => service.getWorksheet(workbook)).toThrow(
        'Workbook does not contain any worksheet',
      );
    });
  });

  describe('getHeaders', () => {
    it('should read headers from the first row', () => {
      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );
      service.writeHeaders(worksheet, [
        'student_code',
        'full_name',
        'email',
        'branch_code',
      ]);

      expect(service.getHeaders(worksheet)).toEqual([
        'student_code',
        'full_name',
        'email',
        'branch_code',
      ]);
    });

    it('should trim and stringify header values', () => {
      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );
      worksheet.addRow([' student_code ', 'full_name']);

      expect(service.getHeaders(worksheet)).toEqual([
        'student_code',
        'full_name',
      ]);
    });
  });

  describe('getRows', () => {
    it('should read all rows except the header row', () => {
      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );
      service.writeHeaders(worksheet, [
        'student_code',
        'full_name',
        'email',
        'branch_code',
      ]);
      service.writeRows(worksheet, [
        ['ST001', 'Nguyen A', 'a@gmail.com', 'HN01'],
        ['ST002', 'Nguyen B', 'b@gmail.com', 'HN01'],
      ]);

      const rows = service.getRows(worksheet);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        rowNumber: 2,
        values: ['ST001', 'Nguyen A', 'a@gmail.com', 'HN01'],
      });
      expect(rows[1]).toEqual({
        rowNumber: 3,
        values: ['ST002', 'Nguyen B', 'b@gmail.com', 'HN01'],
      });
    });

    it('should normalize hyperlink cells to their text', () => {
      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );
      service.writeHeaders(worksheet, [
        'student_code',
        'full_name',
        'email',
        'branch_code',
      ]);
      service.writeRows(worksheet, [['ST001', 'Nguyen A', 'x', 'HN01']]);
      worksheet.getCell('C2').value = {
        text: 'a@gmail.com',
        hyperlink: 'mailto:a@gmail.com',
      };

      const rows = service.getRows(worksheet);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        rowNumber: 2,
        values: ['ST001', 'Nguyen A', 'a@gmail.com', 'HN01'],
      });
    });

    it('should return an empty array when only a header row exists', () => {
      const workbook = service.createTemplate('Students', ['student_code']);

      expect(
        service.getRows(service.getWorksheet(workbook, 'Students')),
      ).toEqual([]);
    });
  });

  describe('writeHeaders', () => {
    it('should write headers as the first row', () => {
      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );

      service.writeHeaders(worksheet, ['code', 'name']);

      expect(service.getHeaders(worksheet)).toEqual(['code', 'name']);
    });
  });

  describe('writeRows', () => {
    it('should write rows below the header row', () => {
      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );
      service.writeHeaders(worksheet, ['code', 'name']);

      service.writeRows(worksheet, [
        ['ST001', 'Nguyen A'],
        ['ST002', 'Nguyen B'],
      ]);

      expect(service.getRows(worksheet)).toEqual([
        { rowNumber: 2, values: ['ST001', 'Nguyen A'] },
        { rowNumber: 3, values: ['ST002', 'Nguyen B'] },
      ]);
    });
  });

  describe('writeWorkbook', () => {
    it('should serialize the workbook to a buffer', async () => {
      const workbook = service.createWorkbook();
      service.addWorksheet(workbook, 'Students');

      const buffer = await service.writeWorkbook(workbook);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      const loaded = await service.readWorkbook(buffer);
      expect(loaded.worksheets[0].name).toBe('Students');
    });
  });

  describe('createTemplate', () => {
    it('should create a workbook with a worksheet and headers', () => {
      const workbook = service.createTemplate('Students', [
        'student_code',
        'full_name',
        'email',
        'branch_code',
      ]);

      const worksheet = service.getWorksheet(workbook, 'Students');

      expect(worksheet.name).toBe('Students');
      expect(service.getHeaders(worksheet)).toEqual([
        'student_code',
        'full_name',
        'email',
        'branch_code',
      ]);
    });

    it('should produce a readable xlsx buffer', async () => {
      const workbook = service.createTemplate('Students', [
        'student_code',
        'full_name',
      ]);

      const buffer = await service.writeWorkbook(workbook);
      const loaded = await service.readWorkbook(buffer);
      const worksheet = service.getWorksheet(loaded, 'Students');

      expect(service.getHeaders(worksheet)).toEqual([
        'student_code',
        'full_name',
      ]);
    });
  });

  describe('exportWorksheet', () => {
    it('should style the header row and enable freeze + autofilter', () => {
      const workbook = service.exportWorksheet({
        name: 'Students',
        headers: ['Student Code', 'Full Name', 'Email', 'Address'],
        rows: [['ST001', 'Nguyen A', 'a@gmail.com', '12 Nguyen Trai']],
        columnWidths: [18, 24, 30, 40],
        wrapColumns: [4],
      });

      const worksheet = service.getWorksheet(workbook, 'Students');
      const headerRow = worksheet.getRow(1);

      expect(headerRow.font?.bold).toBe(true);
      expect(headerRow.height).toBe(28);
      expect(worksheet.views).toEqual([{ state: 'frozen', ySplit: 1 }]);
      expect(worksheet.autoFilter).toBeDefined();
      expect(worksheet.getColumn(1).width).toBe(18);
      expect(worksheet.getColumn(4).width).toBe(40);
      expect(worksheet.getColumn(4).alignment?.wrapText).toBe(true);
      expect(service.getHeaders(worksheet)).toEqual([
        'Student Code',
        'Full Name',
        'Email',
        'Address',
      ]);
      expect(service.getRows(worksheet)).toEqual([
        {
          rowNumber: 2,
          values: ['ST001', 'Nguyen A', 'a@gmail.com', '12 Nguyen Trai'],
        },
      ]);
    });

    it('should sanitize formula-like cell values', () => {
      const workbook = service.exportWorksheet({
        name: 'Students',
        headers: ['Full Name', 'Note'],
        rows: [
          ['=HYPERLINK("x")', '@cmd'],
          ['+849', '-2+3'],
          ['Nguyen Van A', 'normal'],
        ],
      });

      const worksheet = service.getWorksheet(workbook, 'Students');
      const rows = service.getRows(worksheet);

      expect(rows[0].values).toEqual(['\'=HYPERLINK("x")', "'@cmd"]);
      expect(rows[1].values).toEqual(["'+849", "'-2+3"]);
      expect(rows[2].values).toEqual(['Nguyen Van A', 'normal']);
    });

    it('should produce a readable xlsx buffer', async () => {
      const workbook = service.exportWorksheet({
        name: 'Students',
        headers: ['Student Code', 'Full Name', 'Status'],
        rows: [['ST001', 'Nguyen A', 'Active']],
      });

      const buffer = await service.writeWorkbook(workbook);
      const loaded = await service.readWorkbook(buffer);
      const worksheet = service.getWorksheet(loaded, 'Students');

      expect(service.getHeaders(worksheet)).toEqual([
        'Student Code',
        'Full Name',
        'Status',
      ]);
      expect(service.getRows(worksheet)).toEqual([
        { rowNumber: 2, values: ['ST001', 'Nguyen A', 'Active'] },
      ]);
    });
  });

  describe('read integration', () => {
    it('should round-trip buffer -> workbook -> headers -> rows', async () => {
      const headers = ['student_code', 'full_name', 'email', 'branch_code'];
      const data: unknown[][] = [
        ['ST001', 'Nguyen A', 'a@gmail.com', 'HN01'],
        ['ST002', 'Nguyen B', 'b@gmail.com', 'HN01'],
      ];

      const worksheet = service.addWorksheet(
        service.createWorkbook(),
        'Students',
      );
      service.writeHeaders(worksheet, headers);
      service.writeRows(worksheet, data);

      const buffer = await service.writeWorkbook(worksheet.workbook);
      const workbook = await service.readWorkbook(buffer);
      const readWorksheet = service.getWorksheet(workbook, 'Students');

      const rows: ExcelRow[] = service.getRows(readWorksheet);

      expect(service.getHeaders(readWorksheet)).toEqual(headers);
      expect(rows.map((row) => row.values)).toEqual(data);
      expect(rows.map((row) => row.rowNumber)).toEqual([2, 3]);
    });
  });
});
