import { Test, TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: { create: jest.Mock; findAll: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: service }],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls create with userId, dto and org context', () => {
    service.create.mockResolvedValue({ id: 'course-1' });
    const dto = { name: 'Math', code: 'MATH-101' };

    const result = controller.create('user-1', dto, 'org-1');

    expect(service.create).toHaveBeenCalledWith('user-1', dto, {
      organizationId: 'org-1',
    });
    expect(result).toBeDefined();
  });

  it('calls findAll with userId and org context', () => {
    controller.findAll('user-1', 'org-1');

    expect(service.findAll).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });
});
