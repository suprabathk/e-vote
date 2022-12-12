"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Options extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    static getOptions(questionID) {
      return this.findAll({
        where: {
          questionID,
        },
      });
    }

    static addOption({ option, questionID }) {
      return this.create({
        option,
        questionID,
      });
    }

    static deleteOption(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static associate(models) {
      // define association here
      Options.belongsTo(models.Questions, {
        foreignKey: "questionID",
        onDelete: "CASCADE",
      });
    }
  }
  Options.init(
    {
      option: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Options",
    }
  );
  return Options;
};
