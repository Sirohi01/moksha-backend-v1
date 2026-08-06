import { Schema } from "mongoose";
import { encryptField } from "./crypto";

/**
 * Encrypts the given string fields (dot-paths supported, e.g. "address.line1") right before every
 * save — covers Model.create() and document.save(). Only touches paths that were actually set,
 * so re-saving an already-encrypted document never double-encrypts it.
 *
 * Deliberately does NOT hook findOneAndUpdate: none of the write paths that use these fields go
 * through update-by-query, and safely handling array/subdocument updates there would need more
 * care than a generic helper can give. Stick to Model.create()/doc.save() for encrypted fields.
 */
export function encryptFieldsOnSave(schema: Schema, fields: string[]): void {
  schema.pre("save", function (next) {
    for (const field of fields) {
      if (!this.isModified(field)) continue;
      const value = this.get(field);
      if (typeof value === "string" && value.length > 0) {
        this.set(field, encryptField(value));
      }
    }
    next();
  });
}
