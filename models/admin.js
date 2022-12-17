"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    resetPass(password) {
      return this.update({ password });
    }

    static createAdmin({ firstName, lastName, email, password }) {
      return this.create({
        firstName,
        lastName,
        email,
        password,
      });
    }

    static associate(models) {
      // define association here
      Admin.hasMany(models.Election, {
        foreignKey: "adminID",
      });
    }
  }
  Admin.init(
    {
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Admin",
    }
  );
  return Admin;
};
