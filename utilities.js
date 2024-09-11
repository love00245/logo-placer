module.exports.validateEmptyFields = ({ value, type }) => {
    if(!value || (value && typeof value != type) ){
        return false;
    }
    return true;
}