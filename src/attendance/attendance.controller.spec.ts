import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  const attendanceService = {
    getSessionAttendance: jest.fn(),
    updateSessionAttendance: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: attendanceService }],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSessionAttendance', () => {
    it('delegates to the service with the session id and organization context', async () => {
      attendanceService.getSessionAttendance.mockResolvedValue({
        role: 'teacher',
      });

      const result = await controller.getSessionAttendance(
        'user-1',
        'session-1',
        'org-1',
      );

      expect(attendanceService.getSessionAttendance).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        { organizationId: 'org-1' },
      );
      expect(result).toEqual({ role: 'teacher' });
    });

    it('passes an empty organization context when not provided', async () => {
      attendanceService.getSessionAttendance.mockResolvedValue({
        role: 'admin',
      });

      await controller.getSessionAttendance('user-1', 'session-1', undefined);

      expect(attendanceService.getSessionAttendance).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        { organizationId: undefined },
      );
    });
  });

  describe('updateSessionAttendance', () => {
    it('delegates to the service with the dto and organization context', async () => {
      const dto: UpdateAttendanceDto = { records: [] };
      attendanceService.updateSessionAttendance.mockResolvedValue({
        sessionId: 'session-1',
      });

      const result = await controller.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
        'org-1',
      );

      expect(attendanceService.updateSessionAttendance).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        dto,
        { organizationId: 'org-1' },
      );
      expect(result).toEqual({ sessionId: 'session-1' });
    });
  });
});
