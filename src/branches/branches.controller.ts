import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Body() createBranchDto: CreateBranchDto,
  ) {
    return this.branchesService.create(createBranchDto, organizationId);
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.branchesService.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, updateBranchDto, organizationId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.remove(id, organizationId);
  }
}
