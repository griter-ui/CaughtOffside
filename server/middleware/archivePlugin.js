// Archived sample records stay recoverable but are excluded from application queries.
module.exports = mongoose => mongoose.plugin(schema => {
  schema.add({ archivedSample: { type: Boolean, default: false } });
  schema.pre(/^find/, function () {
    this.where({ archivedSample: { $ne: true } });
  });
});
