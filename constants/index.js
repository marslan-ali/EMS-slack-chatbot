const similarityMetrics = ["cosine", "euclidean", "dot_product"];
const prefixForVectorCollections = "company_policies_";
const prefixForPDFVectorCollection = prefixForVectorCollections + "pdf_";
const payrollCollection = "payrolls_lc_pro";
const adjustmentCollection = "adjustments_testP";
const employeeCollection = "employees_testP";

const authorizedSlackIds = [
  "U05SEA4PY5N", // Raja Usman
  "U4J0T7K3R", // Sir Arslan Ali
  "U077D3DHQJY", // Maam Aniqa
  // "U07QMUKJNAF", // Sohaib Shokat
  "U05QTANEK6F", // Syed Husnain Shah
];

module.exports = {
  similarityMetrics,
  authorizedSlackIds,
  prefixForVectorCollections,
  prefixForPDFVectorCollection,
  payrollCollection,
  adjustmentCollection,
  employeeCollection,
};
