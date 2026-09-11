import { Test, TestingModule } from '@nestjs/testing';

import { ClassSessionsController } from './class-sessions.controller';
import { ClassSessionsService } from './class-sessions.service';
import { GenerateSessionsDto } from './dto/generate-sessions.dto';

describe('ClassSessionsController', () => {
  let controller: ClassSessionsController;
  const classSessionsService = {
    generate: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionsController],
      providers: [
        { provide: ClassSessionsService, useValue: classSessionsService },
      ],
    }).compile();

    controller = module.get<ClassSessionsController>(ClassSessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('delegates to the service with the user, class and organization context', async () => {
      const dto: GenerateSessionsDto = {
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      };
      classSessionsService.generate.mockResolvedValue({ created: 1 });

      const result = await controller.generate(
        'user-1',
        'class-1',
        dto,
        'org-1',
      );

      expect(classSessionsService.generate).toHaveBeenCalledWith(
        'user-1',
        'class-1',
        dto,
        { organizationId: 'org-1' },
      );
      expect(result).toEqual({ created: 1 });
    });
  });

  describe('findAll', () => {
    it('splits organizationId out of the query filters', async () => {
      classSessionsService.findAll.mockResolvedValue([]);

      await controller.findAll('user-1', 'class-1', {
        organizationId: 'org-1',
        status: undefined,
      });

      expect(classSessionsService.findAll).toHaveBeenCalledWith(
        'user-1',
        'class-1',
        {},
        { organizationId: 'org-1' },
      );
    });
  });

  describe('findOne', () => {
    it('delegates to the service with the session id', async () => {
      classSessionsService.findOne.mockResolvedValue({ id: 'session-1' });

      const result = await controller.findOne(
        'user-1',
        'class-1',
        'session-1',
        'org-1',
      );

      expect(classSessionsService.findOne).toHaveBeenCalledWith(
        'user-1',
        'class-1',
        'session-1',
        { organizationId: 'org-1' },
      );
      expect(result).toEqual({ id: 'session-1' });
    });
  });
});
