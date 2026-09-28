import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic'; // biến đang chứa chuỗi 'isPublic'

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
