// Helper function untuk deduplication sumber dana
function deduplicateSumberDana(data) {
    if (!data) return "";
    if (typeof data !== "string") data = String(data);
    var sumberDanaUnik = [];
    var daftarSumberDana = data.split(",").map(function(item) {
        return item.trim();
    }).filter(function(item) {
        return item !== "";
    });
    daftarSumberDana.forEach(function(item) {
        if (sumberDanaUnik.indexOf(item) === -1) {
            sumberDanaUnik.push(item);
        }
    });
    return sumberDanaUnik.join(", ");
}
