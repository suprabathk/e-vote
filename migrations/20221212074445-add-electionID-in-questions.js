"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Questions", "electionID", {
      type: Sequelize.DataTypes.INTEGER,
      onDelete: "CASCADE",
    });

    await queryInterface.addConstraint("Questions", {
      fields: ["electionID"],
      type: "foreign key",
      onDelete: "CASCADE",
      references: {
        table: "Elections",
        field: "id",
      },
    });
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Questions", "electionID");
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
