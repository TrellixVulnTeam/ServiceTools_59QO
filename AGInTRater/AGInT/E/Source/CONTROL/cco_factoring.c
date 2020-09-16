/*-----------------------------------------------------------------------

File  : cco_factoring.c

Author: Stephan Schulz

Contents
 
  Functions controlling factoring.

  Copyright 1998, 1999 by the author.
  This code is released under the GNU General Public Licence.
  See the file COPYING in the main CLIB directory for details.
  Run "eprover -h" for contact information.

Changes

<1> Mon Jun  8 17:17:57 MET DST 1998
    New

-----------------------------------------------------------------------*/

#include "cco_factoring.h"



/*---------------------------------------------------------------------*/
/*                        Global Variables                             */
/*---------------------------------------------------------------------*/


/*---------------------------------------------------------------------*/
/*                      Forward Declarations                           */
/*---------------------------------------------------------------------*/


/*---------------------------------------------------------------------*/
/*                         Internal Functions                          */
/*---------------------------------------------------------------------*/



/*---------------------------------------------------------------------*/
/*                         Exported Functions                          */
/*---------------------------------------------------------------------*/


/*-----------------------------------------------------------------------
//
// Function: ComputeAllOrderedFactors()
//
//   Compute all ordered factors of clause and put them into
//   store. Return number of factors.
//
// Global Variables: -
//
// Side Effects    : -
//
/----------------------------------------------------------------------*/

long ComputeAllOrderedFactors(TB_p bank, OCB_p ocb,
			      Clause_p clause, ClauseSet_p store,
			      VarBank_p freshvars) 
{
   Clause_p    factor;
   Eqn_p       test;
   ClausePos_p pos1, pos2;
   long        factor_count = 0;

   if(!ClauseIsHorn(clause) && !ClauseQueryProp(clause,CPNoGeneration))
   {
      pos1 = ClausePosAlloc();
      pos2 = ClausePosAlloc();
   
      test = ClausePosFirstOrderedFactorLiterals(clause, pos1, pos2);
      
      while(test)
      {
	 factor = ComputeOrderedFactor(bank, ocb, pos1, pos2, freshvars);
	 if(factor)
	 {
	    factor_count++;
	    factor->parent1 = clause;
	    factor->proof_depth = clause->proof_depth+1;
	    factor->proof_size  = clause->proof_size+1;
	    ClauseSetTPTPType(factor, ClauseQueryTPTPType(clause));
	    ClauseSetProp(factor, ClauseGiveProps(clause, CPIsSOS));
	    ClauseRegisterChild(clause, factor);
	    DocClauseCreationDefault(factor, inf_factor,clause,NULL);
	    ClauseSetInsert(store, factor);
	 }
	 test = ClausePosNextOrderedFactorLiterals(pos1, pos2);
      }
      ClausePosFree(pos1);
      ClausePosFree(pos2); 
   }
   return factor_count;
}


/*-----------------------------------------------------------------------
//
// Function: ComputeAllEqualityFactors()
//
//   Compute all equality factors of clause and put them into
//   store. Return number of factors.
//
// Global Variables: -
//
// Side Effects    : -
//
/----------------------------------------------------------------------*/

long ComputeAllEqualityFactors(TB_p bank, OCB_p ocb,
			      Clause_p clause, ClauseSet_p store,
			      VarBank_p freshvars) 
{
   Clause_p    factor;
   Eqn_p       test;
   ClausePos_p pos1, pos2;
   long        factor_count = 0;

   if(!ClauseIsHorn(clause) && !ClauseQueryProp(clause,CPNoGeneration))
   {
      pos1 = ClausePosAlloc();
      pos2 = ClausePosAlloc();
   
      test = ClausePosFirstEqualityFactorSides(clause, pos1, pos2);
      
      while(test)
      {
	 factor = ComputeEqualityFactor(bank, ocb, pos1, pos2, freshvars);
	 if(factor)
	 {
	    factor_count++;
	    factor->parent1 = clause;
	    factor->proof_depth = clause->proof_depth+1;
	    factor->proof_size  = clause->proof_size+1;
	    ClauseSetTPTPType(factor, ClauseQueryTPTPType(clause));
	    ClauseSetProp(factor, ClauseGiveProps(clause, CPIsSOS));
	    ClauseRegisterChild(clause, factor);
	    DocClauseCreationDefault(factor, inf_efactor, clause, NULL);
	    ClauseSetInsert(store, factor);
	 }
	 test = ClausePosNextEqualityFactorSides(pos1, pos2);
      }
      ClausePosFree(pos1);
      ClausePosFree(pos2); 
   }
   return factor_count;
}

/*---------------------------------------------------------------------*/
/*                        End of File                                  */
/*---------------------------------------------------------------------*/

