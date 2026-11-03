import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { Transform } from 'class-transformer';
import { ageInYears, dayjs, DATE_FORMAT, isValidDateOnly } from '../utils/time';

/** Nomor HP Indonesia: 08xx / 628xx / +628xx, 10–13 digit */
export const PHONE_REGEX = /^(\+62|62|0)8[1-9]\d{6,10}$/;
/** Min 8 karakter, ada huruf besar, huruf kecil, dan angka */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;
export const PASSWORD_MESSAGE =
  'Password minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, serta angka';
/** NIK karyawan: huruf besar/angka/strip, 3–20 karakter */
export const EMPLOYEE_CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
export const PERSON_NAME_REGEX = /^[\p{L} .'-]+$/u;

type TransformInput = { value: unknown };

export const Trim = () => Transform(({ value }: TransformInput) => (typeof value === 'string' ? value.trim() : value));

export const TrimLower = () =>
  Transform(({ value }: TransformInput) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export const TrimUpper = () =>
  Transform(({ value }: TransformInput) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

/** Hapus spasi/strip pada nomor telepon sebelum divalidasi */
export const NormalizePhone = () =>
  Transform(({ value }: TransformInput) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value));

/** "true"/"false" dari query string atau multipart → boolean */
export const ToBoolean = () =>
  Transform(({ value }: TransformInput) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return value;
  });

/** Tanggal murni format YYYY-MM-DD dan benar-benar valid (tolak 2024-02-30) */
export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} harus berformat YYYY-MM-DD`, ...options },
      validator: { validate: (value: unknown) => isValidDateOnly(value) },
    });
}

export function MinAge(years: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'minAge',
      target: object.constructor,
      propertyName,
      constraints: [years],
      options: { message: `Usia minimal ${years} tahun`, ...options },
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          isValidDateOnly(value) && ageInYears(value) >= (args.constraints[0] as number),
      },
    });
}

export function MaxAge(years: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'maxAge',
      target: object.constructor,
      propertyName,
      constraints: [years],
      options: { message: `Usia maksimal ${years} tahun`, ...options },
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          isValidDateOnly(value) && ageInYears(value) <= (args.constraints[0] as number),
      },
    });
}

/** Tanggal tidak boleh lebih dari N hari ke depan dari hari ini */
export function NotFutureBeyond(days: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'notFutureBeyond',
      target: object.constructor,
      propertyName,
      constraints: [days],
      options: {
        message: `${propertyName} tidak boleh lebih dari ${days} hari ke depan`,
        ...options,
      },
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          if (!isValidDateOnly(value)) return false;
          const limit = dayjs()
            .add(args.constraints[0] as number, 'day')
            .endOf('day');
          return !dayjs(value, DATE_FORMAT, true).isAfter(limit);
        },
      },
    });
}

/** Field ini wajib ada bila field pasangannya diisi (mis. latitude & longitude) */
export function RequiredWith(other: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'requiredWith',
      target: object.constructor,
      propertyName,
      constraints: [other],
      options: {
        message: `${propertyName} wajib diisi bersama ${other}`,
        ...options,
      },
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const otherValue = (args.object as Record<string, unknown>)[args.constraints[0] as string];
          const present = (v: unknown) => v !== undefined && v !== null && v !== '';
          return present(otherValue) === present(value);
        },
      },
    });
}
