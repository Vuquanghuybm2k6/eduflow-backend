import { Test, TestingModule } from '@nestjs/testing';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';

describe('AcademicYearsController', () => {
  let controller: AcademicYearsController;
  let service: AcademicYearsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicYearsController],
      providers: [
        {
          provide: AcademicYearsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            activate: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AcademicYearsController>(AcademicYearsController);
    service = module.get<AcademicYearsService>(AcademicYearsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.activate on the activate endpoint', async () => {
    const activate = jest
      .spyOn(service, 'activate')
      .mockResolvedValue({} as never);

    await controller.activate('user-1', 'ay-1', 'org-1');
    expect(activate).toHaveBeenCalledWith('user-1', 'ay-1', {
      organizationId: 'org-1',
    });
  });
});
