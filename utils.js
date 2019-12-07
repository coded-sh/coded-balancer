class Utils {
  replaceAll(str, find, replace) {
      return str.replace(new RegExp(find, 'g'), replace);
  }

  handleError(res, error, statusCode){
    console.error(error)
    let json = JSON.stringify({ error: error.message });
    res.statusCode = statusCode;
    res.end(json);
  }

}

module.exports = Utils;
