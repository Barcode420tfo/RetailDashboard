import mongoose from 'mongoose';

export const { Schema } = mongoose;
export const text = (required = true) => ({ type: String, trim: true, required });
export const ref = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
export const choice = (values, defaultValue) => ({ type: String, enum: values, required: true, ...(defaultValue ? { default: defaultValue } : {}) });
export const integer = (min = 0, required = true) => ({ type: Number, min, required, validate: Number.isSafeInteger });
export const month = () => ({ ...text(), match: /^\d{4}-(0[1-9]|1[0-2])$/ });
export function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export const day = (required = true) => ({ ...text(required), validate: value => value == null || validDay(value) });
export const plans = ['SLD', 'SAP', 'ESSENTIAL', 'UNCLASSIFIED'];
export function schema(fields, indexes = []) {
  const result = new Schema(fields, { timestamps: true, strict: 'throw', optimisticConcurrency: true });
  for (const [keys, options] of indexes) result.index(keys, options);
  return result;
}
export const model = (name, definition) => mongoose.models[name] || mongoose.model(name, definition);
export const unique = { unique: true };
export const optionalUnique = field => ({ unique: true, partialFilterExpression: { [field]: { $type: 'string' } } });
export function dateRange(definition, start, end) {
  definition.path(end).validate(function(value) { return !value || !this[start] || value >= this[start]; }, `${end} must not precede ${start}`);
  return definition;
}
