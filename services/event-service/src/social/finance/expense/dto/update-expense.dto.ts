import { CreateExpenseDto } from './create-expense.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {
}