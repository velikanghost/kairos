import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { CreateStrategyDto } from '../common/dto/create-strategy.dto';
import { UpdateStrategyDto } from '../common/dto/update-strategy.dto';

@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Post()
  create(@Body(ValidationPipe) dto: CreateStrategyDto) {
    return this.strategiesService.create(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.strategiesService.findByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.strategiesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(ValidationPipe) dto: UpdateStrategyDto) {
    return this.strategiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.strategiesService.delete(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.strategiesService.activate(id);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.strategiesService.deactivate(id);
  }

  @Get(':id/executions')
  getExecutions(@Param('id') id: string) {
    return this.strategiesService.getExecutions(id);
  }
}
