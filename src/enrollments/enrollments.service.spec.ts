import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EnrollmentsService } from './enrollments.service';
import { Enrollment } from './entities/enrollment.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Student } from '../students/entities/student.entity';
import { Class } from '../classes/entities/class.entity';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: {} },
        { provide: getRepositoryToken(Membership), useValue: {} },
        { provide: getRepositoryToken(Student), useValue: {} },
        { provide: getRepositoryToken(Class), useValue: {} },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
