"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn("Voters", "electionID", {
      type: Sequelize.DataTypes.INTEGER,
    });

    await queryInterface.addConstraint("Voters", {
      fields: ["electionID"],
      type: "foreign key",
      references: {
        table: "Elections",
        field: "id",
      },
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn("Voters", "electionID");
  },
};
